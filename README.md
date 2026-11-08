# สีเขียวพิริยาลัย · Cheer Stand

เครื่องมือดูผังแสตนเชียร์ 15 × 10 (คอลัมน์ A–O, แถว 10 → 1) ของคณะสีเขียว พิริยาลัย
มี 10 เพลง · 17 โค้ด · 86 เฟรม และ 20 สี พร้อมมุมมองแสตน ใบเพลง แกลเลอรี และวิเคราะห์

## โครงสร้างโปรเจกต์

```
index.html                 หน้าแอป (เปิดไฟล์นี้ได้เลย)
assets/
  css/app.css              สไตล์ทั้งหมด
  js/app.js                ลอจิกแอปทั้งหมด
  data/app-data.js         ข้อมูลเพลง/เฟรม/สี (APP_DATA)
tools/
  parse_sheets.py          แปลงไฟล์ HTML จาก Google Sheets → stand_data.json
  build_data.py            แปลง stand_data.json → assets/data/app-data.js
  audit_labels.py          ตรวจป้ายที่นั่งที่พิมพ์ผิดในต้นฉบับ
code/
  005-OFFICIALY Code StandCheer/   ไฟล์ต้นฉบับ 10 เพลง
```

ไม่มีขั้นตอน build สำหรับหน้าเว็บ — แก้ `assets/css/app.css`, `assets/js/app.js`
หรือ `assets/data/app-data.js` แล้วรีเฟรชได้ทันที

## วิธีเปิด

เปิด `index.html` ด้วยเบราว์เซอร์ได้โดยตรง (ไฟล์ static ล้วน) หรือรันเซิร์ฟเวอร์ท้องถิ่น:

```bash
python3 -m http.server 8000
# แล้วเปิด http://localhost:8000
```

> ฟอนต์ Prompt / JetBrains Mono โหลดจาก Google Fonts หากไม่มีอินเทอร์เน็ต
> จะ fallback เป็นฟอนต์ระบบตามที่กำหนดไว้ใน CSS

## สร้างข้อมูลใหม่จากต้นฉบับ

```bash
python3 -I tools/parse_sheets.py "code/005-OFFICIALY Code StandCheer" tools/out
python3 -I tools/build_data.py tools/out/stand_data.json assets/data/app-data.js
```

`tools/out/` เป็นไฟล์กลางที่สร้างใหม่ได้ ไม่ได้ commit ไว้

## หมายเหตุสำคัญ · A2 ห้ามเผยแพร่

เนื้อหา สี และผังทั้งหมดอ้างอิงใบเพลงที่ระบุ **“A2 ห้ามเผยแพร่”**
โปรเจกต์นี้มีไว้ใช้ภายในคณะเท่านั้น ก่อนนำขึ้น GitHub หรือเผยแพร่ที่ใด
ต้องได้รับอนุญาตจากผู้รับผิดชอบกิจกรรมก่อน และควรใช้ **private repository**
หากต้องแชร์ให้ทีมงาน หลีกเลี่ยง GitHub Pages แบบ public
