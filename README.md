# สีเขียวพิริยาลัย · Cheer Stand

เครื่องมือดูผังแสตนเชียร์ 15 × 10 (คอลัมน์ A–O, แถว 10 → 1) ของคณะสีเขียว พิริยาลัย
มี 12 เพลง · 17 โค้ด · 134 เฟรม และ 20 สี พร้อมมุมมองแสตน ใบเพลง แกลเลอรี และวิเคราะห์

จุดสำคัญของเวอร์ชันนี้: **ข้อมูลไม่ได้ฝังในโค้ดแล้ว** ทุกอย่างแก้ได้จากตาราง CSV
ใน `tools/data/` และแต่ละเฟรมมีระยะเวลาเป็นบีตของเพลงจริง

## โครงสร้าง

```
index.html                  หน้าแอป
assets/
  css/app.css               สไตล์ทั้งหมด
  js/app.js                 ลอจิกแอป + ไทม์ไลน์ตามบีต
  data/app-data.js          ★ สร้างจาก tools/data/ — อย่าแก้ด้วยมือ
tools/
  data/songs.csv            เพลง + BPM + จำนวนบีตเริ่มต้น
  data/lyrics.csv           เนื้อเพลง
  data/frames.csv           เฟรม + beats + lyric line/highlight
  data/grids.csv            ผังสี 10 แถว × 15 คอลัมน์ ต่อเฟรม
  data/extras.json          สี ใบเพลง โปรแกรม อุปกรณ์ ฯลฯ
  data/README.md            คู่มือแก้ข้อมูลแบบละเอียด
  build_data.py             ตรวจ + สร้าง app-data.js + bump ?v=
  verify_migration.py       ใช้ครั้งเดียวตอนย้ายข้อมูล (ต้องมี LYRIC_SECTION เดิม)
  export_current_data.py    ใช้ครั้งเดียวตอนย้ายข้อมูล (ต้องมี LYRIC_SECTION เดิม)
  tap-tempo.html            หน้าแตะจังหวะเพื่อหา BPM
  parse_sheets.py           ตัว import HTML เดิม (ไม่ใช้ใน build ปกติ)
  audit_labels.py           ตรวจป้ายที่นั่งที่พิมพ์ผิดในต้นฉบับ
code/
  005-OFFICIALY Code StandCheer/   ไฟล์ต้นฉบับ 10 เพลง
```

## แก้ข้อมูลหลังบ้าน

ทุกอย่างอยู่ใน `tools/data/` — เปิดด้วย Excel / Google Sheets / Notepad
แล้วบันทึกเป็น **CSV UTF-8** (Excel: “CSV UTF-8 (Comma delimited)”)

```bash
python3 tools/build_data.py --check   # ตรวจอย่างเดียว
python3 tools/build_data.py           # สร้างข้อมูล + bump ?v=
docker compose restart web            # index.html เป็น bind mount ไฟล์เดี่ยว
```

build จะบอก `ไฟล์:บรรทัด` เป็นภาษาไทยถ้าข้อมูลผิด และจะไม่เขียนทับจนกว่าจะแก้ครบ
รายละเอียดคอลัมน์ทั้งหมดอยู่ที่ [`tools/data/README.md`](tools/data/README.md)

### ตัวอย่างงานที่ทำบ่อย

| ต้องการ | แก้ที่ |
|---|---|
| แก้ชื่อเพลง/รหัส | `songs.csv` |
| แก้เนื้อเพลง | `lyrics.csv` (แล้วตรวจ `lyric_line` ใน `frames.csv`) |
| แก้คำไฮไลต์ | `frames.csv` คอลัมน์ `lyric_highlight` คั่นด้วย `|` |
| แก้ผังสี 1 ช่อง | `grids.csv` แถว/คอลัมน์ตรงใบเพลง |
| เพิ่ม/แทรกเฟรม | เพิ่ม 1 แถว `frames.csv` + 10 แถว `grids.csv`, เรียง `frame_no` ใหม่ |
| เพิ่มเพลง | ต่อท้าย `songs.csv`, `lyrics.csv`, `frames.csv`, `grids.csv` |
| เปลี่ยนความเร็วเพลง | `songs.csv` คอลัมน์ `bpm` / `default_beats` |
| เปลี่ยนเฉพาะบางเฟรม | `frames.csv` คอลัมน์ `beats` |

## ไทม์ไลน์ตามบีตจริง

ระยะเวลาแต่ละเฟรม:

```text
frame_ms = beats × 60000 / bpm
```

- `bpm` และ `default_beats` อยู่ที่ระดับเพลงใน `songs.csv`
- `beats` รายเฟรม override ได้ใน `frames.csv`
- ค่าเริ่มต้น 120 BPM / 16 บีต = 8 วินาทีต่อเฟรม (ถ้าเฟรมไหนไม่ระบุ `beats`)
  — ไทม์ไลน์จริงของทั้งงาน (134 เฟรม) ตอนนี้ 7:44
- ปุ่มความเร็วเป็นอัตราจริง: `0.6×`, `1×` (ตรงกับเพลง), `1.8×`
- ตอนเล่นอัตโนมัติ ไทม์ไลน์เดินตามเวลาและหยุดที่เฟรมสุดท้าย
- ลากไทม์ไลน์จะ snap เข้าเฟรมที่ตรงกับเวลาจริง

หา BPM ของเพลง: เปิด `tools/tap-tempo.html` แล้วแตะตามจังหวะ
หรือใช้สูตรใน [`tools/data/README.md`](tools/data/README.md)

หลัง build ดูเวลาของทุกเฟรมได้ที่ `tools/out/timing-report.csv`

## เปิดดูในเครื่อง

เปิด `index.html` ได้โดยตรง หรือรัน static server:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

> ฟอนต์ Prompt / JetBrains Mono โหลดจาก Google Fonts
> ถ้าไม่มีอินเทอร์เน็ตจะ fallback เป็นฟอนต์ระบบตามที่กำหนดใน CSS

## Deploy (เครื่องนี้)

```bash
docker compose up -d
docker compose restart web   # หลัง build ทุกครั้งที่ index.html เปลี่ยน
```

เว็บเสิร์ฟที่ `http://100.100.225.94:8080/` และผ่าน Cloudflare Tunnel
`http://stand-green.singto1597.xyz/`

`?v=YYYYMMDD-N` ใน `index.html` ถูก bump อัตโนมัติโดย `build_data.py`
เพื่อกัน Cloudflare/browser cache ค้าง — ไม่ต้องแก้เอง

## หมายเหตุสำคัญ · A2 ห้ามเผยแพร่

เนื้อหา สี และผังทั้งหมดอ้างอิงใบเพลงที่ระบุ **“A2 ห้ามเผยแพร่”**
โปรเจกต์นี้มีไว้ใช้ภายในคณะ โปรดตรวจสอบสิทธิ์/การอนุญาตก่อนเผยแพร่
การตั้งค่า repository เป็น public หรือ private ขึ้นอยู่กับดุลพินิจของผู้รับผิดชอบกิจกรรม
