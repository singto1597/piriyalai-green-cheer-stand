# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

เว็บสแตติกสำหรับดูผังแสตนเชียร์ 15 × 10 (คอลัมน์ A–O, แถว 10 → 1) ของคณะสีเขียว พิริยาลัย
— 16 เพลง · 17 โค้ด · 151 เฟรม · 21 สี ฉบับ **Champion & Time Capsule Edition**
หลังคว้าแชมป์ครบ 3 รายการ (สแตน · หลีด · พาเหรด) มีมุมมองแสตน ใบเพลง แกลเลอรี
วิเคราะห์ ผังชื่อเล่น ค้นหาชื่อ/ที่นั่ง/ชั้น ป้ายประจำตัวฉบับแชมป์ + IG Story PNG + ป้ายชื่อ PDF
และโหมดเล่นอัตโนมัติ (มีเมโทรนอม) โดยไม่มี backend และไม่มีฐานข้อมูล

- `index.html` — หน้าแอปไฟล์เดียว (โครง DOM + สคริปต์)
- `assets/css/app.css` — สไตล์ทั้งหมด
- `assets/js/app.js` — ลอจิกแอป + ไทม์ไลน์ล็อกบีต + เมโทรนอม (WebAudio) + เจ้าของ `window.GS`
- `assets/js/gs-students.js` — index/ค้นหา/จับคู่ชื่อนักเรียน 150 คน
- `assets/js/gs-celebration.js` — Welcome dialog ฉลองแชมป์ + พลุ canvas
- `assets/js/gs-search.js` — autocomplete portal (`#saPortal`) ผูกกับ input 5 จุด
- `assets/js/gs-badge.js` — ป้ายประจำตัว: preview การ์ด IG Story `.igs-*` + canvas Story
  + ป้ายชื่อ `.bdg-*` พิมพ์เป็น PDF (ช่องข้อมูลส่วนตัวเป็น “ไม่ระบุ” — PDPA ของเว็บ)
- `assets/img/` — `bg.jpg`, `logo.png`, `tung.png` สำหรับป้าย
- `assets/data/app-data.js` — **ไฟล์ที่ generate จาก CSV/JSON ห้ามแก้ด้วยมือ**
- `tools/data/*.csv`, `students.json`, `extras.json` — ต้นทางข้อมูลจริง (แก้ที่นี่เท่านั้น)
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

# แก้เฉพาะ CSS/JS (bundle ไม่เปลี่ยน) แต่ต้องกัน cache → bump ?v= ตรง ๆ
python3 tools/build_data.py --bump

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
tools/data/students.json ← นักเรียน 150 คน: ที่นั่ง ชื่อเล่น ชื่อจริง ชั้น เลขที่
                           (whitelist 9 คีย์ — ห้ามมีเบอร์โทร/ข้อมูลสุขภาพ)
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
  — ค่าเริ่มต้นเปิดเสียง (จำค่าที่ผู้ใช้เลือกใน `localStorage`)
- **ผลรวม `beats` ต่อเพลงต้อง % 4 == 0** ไม่งั้นบาร์เลื่อนข้ามเพลง (ดู `docs/skills.md`)
- BPM ที่แก้จาก UI (40–240) เป็น override ชั่วคราว ไม่เขียนกลับ CSV

## Pitfalls

- **`index.html` เป็น bind mount ไฟล์เดี่ยว** — editor ที่เขียนไฟล์ใหม่ (Write/vim :w)
  เปลี่ยน inode → nginx ยังเสิร์ฟของเก่า ต้อง `docker compose restart web`
  (`assets/` เป็น mount โฟลเดอร์ → แก้ JS/CSS แล้วเห็นผลทันที)
- **SELinux + `/mnt/storage`** — ไฟล์บนดิสก์นี้เป็น `unlabeled_t`; bind mount ต้องมี
  `:z` (`:ro,z`) ไม่งั้น nginx ฟ้อง permission denied แล้ว restart loop
- **`students.json`** — build รับเฉพาะ whitelist (`position`, `nickname`, `title`,
  `first_name`, `last_name`, `fullname`, `classroom_code`, `grade`, `student_number`)
  และปฏิเสธคีย์ต้องห้าม (`phone`, `contact`, `health`, `allerg`, `disease`, `drug`,
  `congenital`, `guardian`, ฯลฯ) — ห้ามผ่อนกฎนี้
- **ชื่อเล่นซ้ำ** 17 ชื่อ / 35 ที่นั่ง — ห้าม auto-select คนแรกจากชื่อซ้ำ
  `GSStudents.resolve()` คืน `{ambiguous}` ให้ผู้ใช้เลือกด้วยที่นั่ง/ห้อง
- **`.bdg-*` เท่านั้น** สำหรับป้ายประจำตัว — อย่าใช้ `.sheet` (ชนกับ settings sheet)
- **ป้ายชื่อ PDF** ใช้ `#badgePrint` + `@media print` (`@page size: A4 landscape`)
  เติม DOM ตอนกดปุ่มแล้วเรียก `window.print()` — มีแค่ชื่อเล่น/ชื่อจริง/ชั้น/เลขที่/ที่นั่ง
  ส่วนเบอร์โทร–แพ้ยา–แพ้อาหาร–โรคประจำตัวแสดง “ไม่ระบุ” เสมอ
  ห้ามดึงข้อมูลจริงลง `students.json` หรือไฟล์ที่เว็บเสิร์ฟ (นโยบาย PDPA ของเว็บนี้)
- **preview ป้าย = การ์ด IG Story** (`.igs-*` 9:16, container query) ต้องตรงกับ
  `drawStory()` ใน canvas — แก้ดีไซน์ต้องแก้ทั้งสองที่; `.bdg-*` ใช้เฉพาะแผ่นพิมพ์
- **หลังแก้ `index.html` ต้อง `docker compose restart web` เสมอ** เพราะเป็น bind mount
  ไฟล์เดี่ยว; แก้ `assets/` ไม่ต้อง restart
- **ห้ามแก้ `assets/data/app-data.js`** — build จะเขียนทับ และข้อมูลจะไม่ตรง CSV
- **อย่าใช้ `song_id` เป็นลำดับแสดง** — ใช้ `show_code` (ข้อผิดพลาดคลาสสิกของ repo นี้)
- **เพลง placeholder** (13, 14, 15, 16) ใช้ `default_beats` ต่ำ — ถ้าได้เวลาแสดงจริง
  ต้องใส่ `beats` รายเฟรมชัดเจน ไม่งั้นเพลงจะสั้นผิดหลายเท่า
- **เพลงที่จับเวลาแล้ว 12 เพลง** (ตามลำดับแสดง): 13 = 200 BPM, 1 = 223, 2 = 148,
  3 = 149, 14 = 160, 4 = 169, 5 = 171, 6 = 160, 7 = 158, 8 = 157, 11 = 157,
  12 = 155; เหลือ 15, 9, 16, 10 ที่ยัง 180 รอข้อมูลจริง — total ทั้งงาน 6:58
- **เพลง 5–12 ตั้งใจเล่นช้ากว่าเสียงจริง ~1.5 เท่า** (ผู้ใช้ขอให้ช้าลงเพราะร้องตามไม่ทัน;
  ลอง ×2 แล้วช้าเกิน) — เพิ่ม `beats` รายท่อนแต่คง `bpm` เดิม (เมโทรนอมเร็วเท่าเดิม)
  ไม่ได้คูณเท่ากันทุกท่อน: ท่อนเฟรมถี่ได้ ~2 เท่า, ท่อนค้างภาพยาวได้ ~1.2–1.25 เท่า
  เวลาเพลง 5–12 รวม 138 วิ (เดิม 91) — อย่า "แก้กลับ" โดยคิดว่าเป็นข้อมูลผิด
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
