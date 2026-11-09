# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

เว็บสแตติกสำหรับดูผังแสตนเชียร์ 15 × 10 (คอลัมน์ A–O, แถว 10 → 1) ของคณะสีเขียว พิริยาลัย
— 16 เพลง · 17 โค้ด · 151 เฟรม · 21 สี มีมุมมองแสตน ใบเพลง แกลเลอรี วิเคราะห์
และโหมดเล่นอัตโนมัติ (มีเมโทรนอม) โดยไม่มี backend และไม่มีฐานข้อมูล

- `index.html` — หน้าแอปไฟล์เดียว (โครง DOM + สคริปต์)
- `assets/css/app.css` — สไตล์ทั้งหมด
- `assets/js/app.js` — ลอจิกแอป + ไทม์ไลน์ล็อกบีต + เมโทรนอม (WebAudio)
- `assets/data/app-data.js` — **ไฟล์ที่ generate จาก CSV ห้ามแก้ด้วยมือ**
- `tools/data/*.csv` — ต้นทางข้อมูลจริงทั้งหมด (แก้ที่นี่เท่านั้น)
- `tools/build_data.py` — ตรวจ + สร้าง `app-data.js` + รายงานเวลา + bump cache-bust
- `code/` — ไฟล์ใบเพลงต้นฉบับ (HTML) ใช้เป็นแหล่งอ้างอิงผังสี

`docs/skills.md` คือคลังบทเรียนที่เจอจริง (การซิงก์บีตกับเสียงแสดง, ข้อจำกัดของ build tool)
**อ่านก่อนแก้ข้อมูล แล้วต่อบทเรียนใหม่ท้ายไฟล์เมื่อเจอปัญหาใหม่**

## Commands

```bash
# ตรวจข้อมูลอย่างเดียว (ไม่เขียนไฟล์)
python3 tools/build_data.py --check

# สร้าง assets/data/app-data.js + tools/out/timing-report.csv + bump ?v= ใน index.html
python3 tools/build_data.py

# หลัง build ทุกครั้งที่ index.html เปลี่ยน (bind mount ไฟล์เดี่ยว)
docker compose restart web

# เปิด/ปิดเว็บ
docker compose up -d
docker compose down
```

- URL: `http://100.100.225.94:8080/` (Tailscale) หรือ `http://<public-ip>:8080/`
- container: `piriyalai_green_cheer_stand` (nginx:alpine)
- build มี warning ที่ไม่ทำให้ล้ม (เฟรม <1 วิ หรือ >16 วิ, เพลง <15 วิ) — **warning ไม่ใช่ error**
  ถ้าไม่ตรงกับเจตนาให้แก้ข้อมูล ไม่ใช่ไปปิด warning

## Data pipeline

```
tools/data/songs.csv     ← เพลง: song_id, code, show_code, title, bpm, default_beats, ธีมสี
tools/data/frames.csv    ← เฟรม: song_id, frame_no, code, name, cue, insight, beats, lyric_line, lyric_highlight
tools/data/grids.csv     ← ผังสี 150 ช่อง (10 แถว × 15 คอลัมน์) ต่อเฟรม
tools/data/lyrics.csv    ← เนื้อเพลง ( lyric_line อ้างเลขบรรทัด 1-based )
tools/data/extras.json   ← สี ใบเพลง โปรแกรม อุปกรณ์ ฯลฯ
        ↓  python3 tools/build_data.py
assets/data/app-data.js  (runtime อ่านไฟล์นี้เท่านั้น)
```

- **ลำดับเพลงในงานยึด `show_code` ไม่ใช่ `song_id`** — build ดึงเลขนำหน้าของ `show_code`
  (เช่น `14–15` → 14) แล้วเรียง; ลำดับจริงคือ 13, 1, 2, 3, 14, 4, 5, 6, 7, 8, 11, 12, 15, 9, 16, 10
- CSV ต้องเป็น **UTF-8** (มี BOM ได้ — build อ่านด้วย `utf-8-sig`)
- `beats` เว้นว่าง = ใช้ `default_beats` ของเพลง; ค่าที่รับคือ **1–128**
- `lyric_line` เป็น 1-based; `-1` หรือเว้นว่าง = เฟรมบรรเลง
- เพิ่ม/แทรกเฟรม = เพิ่มแถว `frames.csv` **และ** `grids.csv` 10 แถว แล้วเรียง `frame_no` ใหม่
- ห้ามแก้ `assets/data/app-data.js` หรือ `?v=` ใน `index.html` ด้วยมือ — build จัดการ
  (bump `?v=YYYYMMDD-N` เฉพาะเมื่อ bundle เปลี่ยน)

## Timing model (หัวใจของโปรเจกต์)

```text
frame_ms = beats × 60000 / bpm          (bpm = ระดับเพลง, beats = ระดับเฟรม)
```

- ทุกเฟรมเริ่มที่ **บีตจำนวนเต็ม** → ภาพเปลี่ยนตรงบีต 1 ของห้อง
- ภาพและเมโทรนอมเดินจากนาฬิกาบีตตัวเดียวกัน: `showBeatStart` + `playPosBeat()`
  → `playPump()` (ทุก 20 ms) เลื่อนเฟรมเมื่อข้าม `showBeatStart + beats`;
  `metroPump()` เคาะจาก anchor เดียวกัน
- ตอนข้ามเพลง/BPM เปลี่ยน ระบบ re-anchor แต่คงตำแหน่งบีตปัจจุบัน
  (`anchorClock(beat)` ใช้ `60000 / songBpm(curSong())`)
- เมโทรนอมเน้นบีต 1 ของห้องด้วย `Math.round(beat) % 4 === 0` (1245 Hz vs 1000 Hz)
  — ค่าเริ่มต้นปิดเสียง
- **ผลรวม `beats` ต่อเพลงต้อง % 4 == 0** ไม่งั้นบาร์เลื่อนข้ามเพลง (ดู `docs/skills.md`)
- BPM ที่แก้จาก UI (40–240) เป็น override ชั่วคราว ไม่เขียนกลับ CSV

## Pitfalls

- **`index.html` เป็น bind mount ไฟล์เดี่ยว** — editor ที่เขียนไฟล์ใหม่ (Write/vim :w)
  เปลี่ยน inode → nginx ยังเสิร์ฟของเก่า ต้อง `docker compose restart web`
  (`assets/` เป็น mount โฟลเดอร์ → แก้ JS/CSS แล้วเห็นผลทันที)
- **ห้ามแก้ `assets/data/app-data.js`** — build จะเขียนทับ และข้อมูลจะไม่ตรง CSV
- **อย่าใช้ `song_id` เป็นลำดับแสดง** — ใช้ `show_code` (ข้อผิดพลาดคลาสสิกของ repo นี้)
- **เพลง placeholder** (13, 14, 15, 16) ใช้ `default_beats` ต่ำ — ถ้าได้เวลาแสดงจริง
  ต้องใส่ `beats` รายเฟรมชัดเจน ไม่งั้นเพลงจะสั้นผิดหลายเท่า
- **เพลงที่จับเวลาแล้ว 12 เพลง** (ตามลำดับแสดง): 13 = 200 BPM, 1 = 223, 2 = 148,
  3 = 149, 14 = 160, 4 = 169, 5 = 171, 6 = 160, 7 = 158, 8 = 157, 11 = 157,
  12 = 155; เหลือ 15, 9, 16, 10 ที่ยัง 180 รอข้อมูลจริง — total ทั้งงาน 6:11
- **ช่องว่างของซิมูเลชัน**: intro/outro ที่ไม่มีกริดถูกยืด `beats` ของเฟรมแรก/สุดท้าย
  ไม่ใช่การเพิ่มเฟรม; ช่วงพักระหว่างเพลง **ไม่ถูกจำลอง** (ผู้ใช้เลือก "ข้ามช่วงพัก")
- ไฟล์ใน `code/` เป็นต้นฉบับใบเพลง — ใช้ตรวจผังสี แต่ไม่ใช่ input ของ build

## Deploy

Repo นี้เสิร์ฟด้วย nginx container เดียว (ไม่มี build step ฝั่ง frontend):

1. แก้ข้อมูล → `python3 tools/build_data.py`
2. `docker compose restart web` (เพราะ `index.html` เปลี่ยนจาก cache-bust)
3. ตรวจ `tools/out/timing-report.csv` เทียบเวลาจริง และเปิดเว็บเล่นตั้งแต่ต้น

`docker-compose.yml` ผูกพอร์ต `0.0.0.0:8080:80` และ mount เฉพาะ `index.html`, `assets/`,
`nginx.conf` (ไม่ขึ้น `.git`, `tools/`, `code/` ขึ้นเว็บ)
