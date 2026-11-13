/* ============================================================
   GSBadge — ป้ายประจำตัว + การ์ด IG Story
   - ตัวอย่างการ์ด IG Story (9:16) ตรงกับไฟล์ PNG 1080×1920 ที่ดาวน์โหลด
   - ป้ายชื่อ A4 แนวนอน พิมพ์/บันทึกเป็น PDF ผ่านหน้าต่างพิมพ์
     (ช่องข้อมูลส่วนตัวแสดง “ไม่ระบุ” — ไม่มีเบอร์โทร/ข้อมูลสุขภาพของน้อง)
   ============================================================ */
(function () {
  'use strict';

  const GS = () => window.GS;
  const DBG = () => window.GSStudents;

  const FONT_HEAD = "'Prompt', sans-serif";
  const FONT_BODY = "'Anuphan', 'Prompt', sans-serif";
  const FONT_TALL = "'Anton', 'Prompt', sans-serif";

  let modalOpen = false;
  let modalSeat = null;
  let lastFocus = null;
  let imgPromise = null;

  /* ---------- helpers ---------- */
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function sanitizeName(v) {
    return String(v == null ? '' : v)
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 60) || 'student';
  }

  function statsFor(seat) {
    const g = GS();
    const idx = g.SEAT_INDEX.get(seat);
    if (idx == null) return null;
    return g.seatStats[idx] || null;
  }

  const ACTIONS = `<div class="bdg-actions">
        <button class="btn-primary" type="button" data-badge-dl="story">⬇ ดาวน์โหลด IG Story</button>
        <button class="btn-ghost" type="button" data-badge-print>🖨️ โหลดป้ายชื่อ (PDF)</button>
      </div>`;

  /* ป้ายชื่อ A4 แนวนอน — ชื่อเล่น ชื่อจริง ชั้น เลขที่ และที่นั่ง
     ช่องข้อมูลส่วนตัวแสดง “ไม่ระบุ” ทั้งหมด เพื่อความปลอดภัยของน้อง */
  function printSheetHTML(seat) {
    const g = GS();
    const stu = DBG() ? DBG().get(seat) : null;
    if (!g || !stu) return '';

    return `
    <div class="bdg-stage">
      <div class="bdg-sheet">
        <div class="bdg-bg"><img src="assets/img/bg.jpg" alt=""></div>
        <div class="bdg-shade"></div>
        <div class="bdg-border"></div>
        <div class="bdg-canvas">
          <header class="bdg-header">
            <div class="bdg-media bdg-logo">
              <img src="assets/img/logo.png" alt="ตราโรงเรียน" onerror="this.parentElement.classList.add('use-fallback')">
              <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="58" fill="#fff" stroke="#1b3664" stroke-width="2.5"/><circle cx="60" cy="60" r="52" fill="none" stroke="#c92a2a" stroke-width="14"/><circle cx="60" cy="60" r="44" fill="#fff" stroke="#1b3664" stroke-width="2"/><path d="M32 54 L88 54 L76 74 L65 74 L65 86 L76 90 L44 90 L55 86 L55 74 L44 74 Z" fill="#f0c243" stroke="#1b3664" stroke-width="2.2"/></svg>
            </div>
            <div class="bdg-media bdg-tung">
              <img src="assets/img/tung.png" alt="ลายตุง" onerror="this.parentElement.classList.add('use-fallback')">
              <svg viewBox="0 0 220 90" aria-hidden="true"><polygon points="110,4 148,45 110,86 72,45" fill="#1b3c73" stroke="#f2c96b" stroke-width="2.5"/><polygon points="110,16 136,45 110,74 84,45" fill="#c92a2a" stroke="#fff" stroke-width="1.8"/><polygon points="110,28 124,45 110,62 96,45" fill="#f2c96b"/><polygon points="72,45 44,24 26,45 44,66" fill="#e67700"/><polygon points="44,45 20,27 4,45 20,63" fill="#f2c96b"/><polygon points="148,45 176,24 194,45 176,66" fill="#e67700"/><polygon points="176,45 200,27 216,45 200,63" fill="#f2c96b"/></svg>
            </div>
            <div class="bdg-titles">
              <h1>กรีฑาสีผึ้งน้อยเกมส์ครั้งที่ 50 ปีการศึกษา 2569</h1>
              <p>โรงเรียนพิริยาลัยจังหวัดแพร่</p>
            </div>
          </header>

          <section class="bdg-main">
            <div class="bdg-left">
              <div class="bdg-team">คณะสีเขียว</div>
              <div class="bdg-panel bdg-pos">
                <div class="bdg-pos-label">ตำแหน่ง</div>
                <div class="bdg-pos-code">${esc(seat)}</div>
              </div>
            </div>

            <div class="bdg-panel bdg-info">
              <div class="bdg-identity">
                <div class="bdg-nick">${esc(stu.nickname)}</div>
                <div class="bdg-fullname"><span>ชื่อ :</span><b>${esc(stu.fullname)}</b></div>
              </div>

              <div class="bdg-details">
                <div class="bdg-row bdg-inline">
                  <span class="bdg-pair"><span class="bdg-key">ชั้น :</span><span class="bdg-val">${esc(stu.grade)}</span></span>
                  <span class="bdg-pair"><span class="bdg-key">เลขที่ :</span><span class="bdg-val">${esc(stu.studentNumber)}</span></span>
                </div>
                <div class="bdg-row"><span class="bdg-key">เบอร์โทรศัพท์ :</span><span class="bdg-val bdg-unknown">ไม่ระบุ</span></div>
                <div class="bdg-row"><span class="bdg-key">การแพ้ยา :</span><span class="bdg-val bdg-unknown">ไม่ระบุ</span></div>
                <div class="bdg-row"><span class="bdg-key">การแพ้อาหาร :</span><span class="bdg-val bdg-unknown">ไม่ระบุ</span></div>
                <div class="bdg-row"><span class="bdg-key">โรคประจำตัว :</span><span class="bdg-val bdg-unknown">ไม่ระบุ</span></div>
              </div>

              <footer class="bdg-quote"><p>" ชัยชนะต้องมาจากการสู้ของน้องๆ<br>และการให้ความร่วมมือกับทุกสิ่งจนถึงที่สุด "</p></footer>
            </div>
          </section>
        </div>
      </div>
    </div>`;
  }

  /* การ์ด IG Story (9:16) — ตัวอย่างหน้าจอของไฟล์ PNG ที่ดาวน์โหลด
     มีสถิติ + ผังจิ๋วไฮไลต์ที่นั่งของน้อง (ตามเฟรมที่กำลังดูอยู่) */
  function storyHTML(seat, withActions) {
    const g = GS();
    const stu = DBG() ? DBG().get(seat) : null;
    if (!g || !stu) return '';
    const stt = statsFor(seat) || { transitions: 0, plateDistinct: 0, handFrames: 0, topPlate: null };
    const st = g.curStep();
    const seatK = (10 - parseInt(seat.slice(1), 10)) * 15 + g.COL_INDEX[seat[0]];
    let cells = '';
    for (let k = 0; k < 150; k += 1) {
      const on = k === seatK;
      cells += `<i class="igs-cell${on ? ' is-seat' : ''}" style="--c:${g.PALETTE[st.pals[k]] || '#ffffff'}"${on ? ` data-tag="${esc(seat)}"` : ''}></i>`;
    }

    return `
    <div class="igs-stage">
      <figure class="igs-card" aria-label="การ์ด IG Story ของ ${esc(stu.nickname)}">
        <img class="igs-bg" src="assets/img/bg.jpg" alt="">
        <div class="igs-shade"></div>
        <div class="igs-frame"></div>
        <div class="igs-body">
          <header class="igs-head">
            <span class="igs-logo"><img src="assets/img/logo.png" alt="ตราโรงเรียน"></span>
            <span class="igs-tung"><img src="assets/img/tung.png" alt=""></span>
            <span class="igs-titles">
              <b>กรีฑาสีผึ้งน้อยเกมส์ครั้งที่ 50</b>
              <i>โรงเรียนพิริยาลัยจังหวัดแพร่</i>
            </span>
          </header>

          <div class="igs-pill">🏆 TRIPLE CROWN CHAMPIONS · ผึ้งน้อยเกมส์ ครั้งที่ 50</div>

          <div class="igs-idcard">
            <div class="igs-pos"><span>ตำแหน่ง</span><b>${esc(seat)}</b></div>
            <div class="igs-ident">
              <b class="igs-nick">${esc(stu.nickname)}</b>
              <span class="igs-fullname">${esc(stu.fullname)}</span>
              <span class="igs-meta">${esc(stu.grade)} · เลขที่ ${esc(stu.studentNumber)}</span>
              <span class="igs-role">1 ใน 150 จิ๊กซอว์ผู้สร้างตำนานสีเขียว</span>
            </div>
          </div>

          <div class="igs-stats">
            <div class="is-gold"><b>${stt.transitions} ครั้ง</b><span>เปลี่ยนเพลทสี</span></div>
            <div><b>${stt.plateDistinct}/20 สี</b><span>เพลทที่ใช้</span></div>
            <div><b>${stt.handFrames} เฟรม</b><span>ขึ้นมือ/พื้น</span></div>
          </div>

          <p class="igs-gridlabel">ตำแหน่งของน้องบนผัง · เฟรม ${st.gi + 1}/${g.flat.length} · ${esc(st.code)}</p>

          <div class="igs-gridwrap"><div class="igs-grid">${cells}</div></div>

          <div class="igs-quote">" ชัยชนะต้องมาจากการสู้ของน้องๆ<br>และการให้ความร่วมมือกับทุกสิ่งจนถึงที่สุด "</div>
          <p class="igs-foot">คณะสีเขียว พิริยาลัย · ผึ้งน้อยเกมส์ ครั้งที่ 50 · GREEN CHEER STAND 50</p>
        </div>
      </figure>
      ${withActions ? ACTIONS : ''}
    </div>`;
  }

  function previewHTML(seat) {
    return storyHTML(seat, true);
  }

  function printHTML(seat) {
    return printSheetHTML(seat);
  }

  function emptyHTML() {
    return `<div class="bdg-empty">
      <b>ยังไม่ได้เลือกที่นั่ง</b>
      <span>เลือกที่นั่งของตัวเองจากผัง หรือพิมพ์ชื่อเล่น/ชื่อจริงในช่องด้านบน<br>แล้วการ์ด IG Story และป้ายชื่อของน้องจะปรากฏที่นี่</span>
    </div>`;
  }

  function renderView(seat) {
    const mount = document.getElementById('badgeViewMount');
    if (!mount) return;
    const ok = Boolean(seat && DBG() && DBG().get(seat) && GS());
    mount.innerHTML = ok ? previewHTML(seat) : emptyHTML();
    syncToolbar(ok);
  }

  function syncToolbar(ok) {
    ['badgeDlStory', 'badgeDlName'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = !ok;
    });
  }

  function renderModal(seat) {
    const mount = document.getElementById('badgeModalMount');
    if (!mount) return;
    mount.innerHTML = previewHTML(seat);
  }

  function openModal(seat) {
    const modal = document.getElementById('badgeModal');
    if (!modal || !seat) return;
    const g = GS();
    if (g && g.state.seat !== seat) g.selectSeat(seat, { force: true });
    modalSeat = seat;
    lastFocus = document.activeElement;
    renderModal(seat);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('badge-open');
    modalOpen = true;
    const close = document.getElementById('badgeModalClose');
    if (close) setTimeout(() => close.focus({ preventScroll: true }), 60);
  }

  function closeModal() {
    const modal = document.getElementById('badgeModal');
    if (!modal || !modalOpen) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('badge-open');
    modalOpen = false;
    if (lastFocus && typeof lastFocus.focus === 'function') {
      lastFocus.focus({ preventScroll: true });
    }
  }

  function sync(seat) {
    const g = GS();
    if (g && g.state.view === 'badge') renderView(seat);
    if (modalOpen) {
      if (!seat) closeModal();
      else if (modalSeat !== seat) {
        modalSeat = seat;
        renderModal(seat);
      }
    }
  }

  /* ---------- canvas ---------- */
  function rr(ctx, x, y, w, h, r) {
    const rad = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function loadImages() {
    if (!imgPromise) {
      imgPromise = Promise.all([
        loadImage('assets/img/bg.jpg'),
        loadImage('assets/img/logo.png'),
        loadImage('assets/img/tung.png'),
      ]).then(([bg, logo, tung]) => ({ bg, logo, tung }));
    }
    return imgPromise;
  }

  function ensureFonts() {
    const timeout = new Promise((r) => setTimeout(r, 2500));
    if (!document.fonts || !document.fonts.load) return timeout;
    const loads = [
      document.fonts.load('400 100px Anton'),
      document.fonts.load('700 100px Prompt'),
      document.fonts.load('800 100px Prompt'),
      document.fonts.load('500 100px Anuphan'),
      document.fonts.load('600 100px Anuphan'),
    ].map((p) => p.catch(() => null));
    const ready = Promise.all(loads).then(() => document.fonts.ready).catch(() => null);
    return Promise.race([ready, timeout]);
  }

  function cover(ctx, img, W, H) {
    if (!img || !img.width) return;
    const s = Math.max(W / img.width, H / img.height);
    const dw = img.width * s;
    const dh = img.height * s;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  function fitFont(ctx, text, maxWidth, size, weight, family) {
    let s = size;
    while (s > 10) {
      ctx.font = `${weight} ${s}px ${family}`;
      if (ctx.measureText(text).width <= maxWidth) break;
      s -= 2;
    }
    return s;
  }

  function drawStory(seat, imgs) {
    const g = GS();
    const stu = DBG().get(seat);
    const stt = statsFor(seat) || { transitions: 0, plateDistinct: 0, handFrames: 0, topPlate: null };
    const st = g.curStep();
    const W = 1080;
    const H = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    cover(ctx, imgs.bg, W, H);
    const shade = ctx.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, 'rgba(5,12,8,.86)');
    shade.addColorStop(0.3, 'rgba(5,12,8,.5)');
    shade.addColorStop(0.62, 'rgba(5,12,8,.68)');
    shade.addColorStop(1, 'rgba(3,9,6,.94)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H);

    /* frame */
    ctx.strokeStyle = 'rgba(255,209,102,.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(26, 26, W - 52, H - 52);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    /* header */
    const logoSize = 96;
    if (imgs.logo) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(64 + logoSize / 2, 90, logoSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(imgs.logo, 64, 90 - logoSize / 2, logoSize, logoSize);
      ctx.restore();
    }
    if (imgs.tung) ctx.drawImage(imgs.tung, 180, 90 - 30, 152, 60);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 30px ${FONT_HEAD}`;
    ctx.fillText('กรีฑาสีผึ้งน้อยเกมส์ครั้งที่ 50', 350, 74);
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.font = `500 23px ${FONT_HEAD}`;
    ctx.fillText('โรงเรียนพิริยาลัยจังหวัดแพร่', 350, 112);

    /* pill */
    ctx.textAlign = 'center';
    const pillW = 720;
    const pillH = 62;
    const pillX = (W - pillW) / 2;
    const pillY = 166;
    const pg = ctx.createLinearGradient(pillX, pillY, pillX, pillY + pillH);
    pg.addColorStop(0, 'rgba(244,197,66,.26)');
    pg.addColorStop(1, 'rgba(244,197,66,.10)');
    rr(ctx, pillX, pillY, pillW, pillH, 31);
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,209,102,.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffe08a';
    ctx.font = `600 26px ${FONT_HEAD}`;
    ctx.fillText('🏆 TRIPLE CROWN CHAMPIONS · ผึ้งน้อยเกมส์ ครั้งที่ 50', W / 2, pillY + pillH / 2 + 1);

    /* identity card */
    const cardX = 70;
    const cardY = 266;
    const cardW = W - 140;
    const cardH = 300;
    const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    cardGrad.addColorStop(0, 'rgba(16,78,38,.88)');
    cardGrad.addColorStop(1, 'rgba(8,42,20,.95)');
    rr(ctx, cardX, cardY, cardW, cardH, 30);
    ctx.fillStyle = cardGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.26)';
    ctx.lineWidth = 2;
    ctx.stroke();

    /* pos block */
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,.78)';
    ctx.font = `600 22px ${FONT_HEAD}`;
    ctx.fillText('ตำแหน่ง', cardX + 150, cardY + 58);
    const posSize = fitFont(ctx, seat, 240, 150, '400', FONT_TALL);
    ctx.font = `400 ${posSize}px ${FONT_TALL}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(seat, cardX + 150, cardY + 185);

    /* divider */
    ctx.strokeStyle = 'rgba(255,255,255,.2)';
    ctx.beginPath();
    ctx.moveTo(cardX + 296, cardY + 42);
    ctx.lineTo(cardX + 296, cardY + cardH - 42);
    ctx.stroke();

    /* nickname + fullname */
    ctx.textAlign = 'left';
    const nickX = cardX + 336;
    const nickMax = cardW - 376;
    const nSize = fitFont(ctx, stu.nickname, nickMax, 84, '800', FONT_HEAD);
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${nSize}px ${FONT_HEAD}`;
    ctx.fillText(stu.nickname, nickX, cardY + 120);
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.font = `500 25px ${FONT_BODY}`;
    ctx.fillText(stu.fullname, nickX, cardY + 186);
    ctx.fillStyle = '#ffd166';
    ctx.font = `600 23px ${FONT_BODY}`;
    ctx.fillText(`${stu.grade} · เลขที่ ${stu.studentNumber}`, nickX, cardY + 226);
    ctx.fillStyle = 'rgba(255,255,255,.62)';
    ctx.font = `500 21px ${FONT_HEAD}`;
    ctx.fillText('1 ใน 150 จิ๊กซอว์ผู้สร้างตำนานสีเขียว', nickX, cardY + 264);

    /* stat boxes */
    const boxes = [
      { v: `${stt.transitions} ครั้ง`, k: 'เปลี่ยนเพลทสี' },
      { v: `${stt.plateDistinct}/20 สี`, k: 'เพลทที่ใช้' },
      { v: `${stt.handFrames} เฟรม`, k: 'ขึ้นมือ/พื้น' },
    ];
    const boxGap = 16;
    const boxW = (cardW - boxGap * 2) / 3;
    const boxY = 596;
    const boxH = 108;
    boxes.forEach((b, i) => {
      const bx = cardX + i * (boxW + boxGap);
      rr(ctx, bx, boxY, boxW, boxH, 18);
      ctx.fillStyle = 'rgba(0,0,0,.34)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.18)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = i === 0 ? '#ffd166' : '#ffffff';
      ctx.font = `700 32px ${FONT_HEAD}`;
      ctx.fillText(b.v, bx + boxW / 2, boxY + 46);
      ctx.fillStyle = 'rgba(255,255,255,.62)';
      ctx.font = `500 20px ${FONT_HEAD}`;
      ctx.fillText(b.k, bx + boxW / 2, boxY + 80);
    });

    /* mini grid */
    const gridLabelY = 754;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.font = `500 21px ${FONT_HEAD}`;
    ctx.fillText('ตำแหน่งของน้องบนผัง · เฟรม ' + (st.gi + 1) + '/' + g.flat.length + ' · ' + st.code, W / 2, gridLabelY);

    const gridW = 900;
    const gridH = 600;
    const gridX = (W - gridW) / 2;
    const gridY = 786;
    const gap = 4;
    const cell = (gridW - gap * 14) / 15;
    const rowGap = (gridH - cell * 10) / 9;
    const seatK = (10 - parseInt(seat.slice(1), 10)) * 15 + g.COL_INDEX[seat[0]];

    /* frame plate behind grid */
    rr(ctx, gridX - 14, gridY - 14, gridW + 28, gridH + 28, 20);
    ctx.fillStyle = 'rgba(4,10,7,.56)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    for (let k = 0; k < 150; k += 1) {
      const row = Math.floor(k / 15);
      const col = k % 15;
      const x = gridX + col * (cell + gap);
      const y = gridY + row * (cell + rowGap);
      ctx.globalAlpha = k === seatK ? 1 : 0.82;
      ctx.fillStyle = g.PALETTE[st.pals[k]] || '#ffffff';
      rr(ctx, x, y, cell, cell, 3);
      ctx.fill();
      if (k === seatK) {
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.shadowColor = '#ffd166';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 5;
        rr(ctx, x - 3, y - 3, cell + 6, cell + 6, 5);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;

    /* highlight label */
    const seatRowIdx = Math.floor(seatK / 15);
    const seatColIdx = seatK % 15;
    const sx = gridX + seatColIdx * (cell + gap) + cell / 2;
    const sy = gridY + seatRowIdx * (cell + rowGap) - 14;
    const tagW = 92;
    const tagH = 34;
    rr(ctx, sx - tagW / 2, sy - tagH, tagW, tagH, 8);
    ctx.fillStyle = '#ffd166';
    ctx.fill();
    ctx.fillStyle = '#17220f';
    ctx.font = `700 20px ${FONT_HEAD}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(seat, sx, sy - tagH / 2 + 1);

    /* quote */
    const qY = 1486;
    const qW = W - 140;
    rr(ctx, 70, qY, qW, 176, 22);
    ctx.fillStyle = 'rgba(0,0,0,.38)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.font = `500 26px ${FONT_HEAD}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('" ชัยชนะต้องมาจากการสู้ของน้องๆ', W / 2, qY + 48);
    ctx.fillText('และการให้ความร่วมมือกับทุกสิ่งจนถึงที่สุด "', W / 2, qY + 88);

    /* footer */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,.62)';
    ctx.font = `500 20px ${FONT_MONO()}`;
    ctx.fillText('คณะสีเขียว พิริยาลัย · ผึ้งน้อยเกมส์ ครั้งที่ 50 · GREEN CHEER STAND 50', W / 2, 1736);

    return canvas;
  }

  function FONT_MONO() {
    return "'JetBrains Mono', monospace";
  }

  function toBlob(canvas) {
    return new Promise((resolve, reject) => {
      if (canvas.toBlob) {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('toBlob failed'));
        }, 'image/png');
      } else {
        try {
          const data = canvas.toDataURL('image/png').split(',')[1];
          const bin = atob(data);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
          resolve(new Blob([bytes], { type: 'image/png' }));
        } catch (err) {
          reject(err);
        }
      }
    });
  }

  function saveBlob(blob, filename) {
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: filename })
        .catch(() => downloadBlob(blob, filename));
    }
    downloadBlob(blob, filename);
    return Promise.resolve();
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function download(seat) {
    const g = GS();
    if (!g || !seat || !DBG() || !DBG().get(seat)) return;
    const stu = DBG().get(seat);
    const buttons = document.querySelectorAll('[data-badge-dl]');
    buttons.forEach((b) => { b.disabled = true; });
    g.showToast('กำลังสร้างการ์ด IG Story…');
    try {
      await ensureFonts();
      const imgs = await loadImages();
      const canvas = drawStory(seat, imgs);
      const blob = await toBlob(canvas);
      const filename = `GreenStand50_Story_${seat}_${sanitizeName(stu.nickname)}.png`;
      await saveBlob(blob, filename);
      g.showToast('พร้อมแล้ว · <b>' + esc(filename) + '</b>');
    } catch (err) {
      console.error('[GSBadge]', err);
      g.showToast('สร้างการ์ดไม่สำเร็จ — ลองใหม่อีกครั้ง');
    } finally {
      buttons.forEach((b) => {
        const inModal = b.closest('#badgeModalMount');
        const has = inModal ? Boolean(modalSeat) : Boolean(g.state.seat);
        b.disabled = !has;
      });
    }
  }

  /* ป้ายชื่อ A4 แนวนอน → หน้าต่างพิมพ์ → “บันทึกเป็น PDF” */
  async function preparePrint(seat) {
    const host = document.getElementById('badgePrint');
    if (!host) return null;
    if (!seat || !DBG() || !DBG().get(seat) || !GS()) return null;
    await ensureFonts();
    await loadImages();
    host.innerHTML = printHTML(seat);
    host.setAttribute('aria-hidden', 'false');
    /* ให้รูป/ฟอนต์ได้ layout หนึ่งเฟรมก่อนเปิดหน้าต่างพิมพ์ */
    await new Promise((r) => setTimeout(r, 180));
    return host;
  }

  async function printBadge(seat) {
    const g = GS();
    if (!g || !seat || !DBG() || !DBG().get(seat)) return;
    const buttons = document.querySelectorAll('[data-badge-print]');
    buttons.forEach((b) => { b.disabled = true; });
    g.showToast('กำลังเตรียมป้ายชื่อ…');
    try {
      const host = await preparePrint(seat);
      if (!host) return;
      window.print();
      g.showToast('เลือก “บันทึกเป็น PDF” ในหน้าต่างพิมพ์ เพื่อเก็บป้ายชื่อ');
    } catch (err) {
      console.error('[GSBadge]', err);
      g.showToast('เตรียมป้ายชื่อไม่สำเร็จ — ลองใหม่อีกครั้ง');
    } finally {
      buttons.forEach((b) => { b.disabled = false; });
    }
  }

  /* ---------- wiring ---------- */
  function init() {
    const modal = document.getElementById('badgeModal');
    const close = document.getElementById('badgeModalClose');

    if (close) close.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
      modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeModal();
          return;
        }
        if (e.key !== 'Tab') return;
        const focusables = Array.from(modal.querySelectorAll(
          'button, [href], input, [tabindex]:not([tabindex="-1"])'
        )).filter((el) => !el.disabled && el.offsetParent !== null);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
          e.preventDefault();
          first.focus();
        }
      });
    }

    const nameBtn = document.getElementById('badgeDlName');
    const story = document.getElementById('badgeDlStory');
    const g = () => GS();
    if (nameBtn) nameBtn.addEventListener('click', () => printBadge(g() && g().state.seat));
    if (story) story.addEventListener('click', () => download(g() && g().state.seat));

    const go = document.getElementById('badgeSeatGo');
    const input = document.getElementById('badgeSeatInput');
    const submitSeat = () => {
      if (window.GSSearch) window.GSSearch.submit(input, { stayView: true });
    };
    if (go) go.addEventListener('click', submitSeat);
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitSeat();
        }
      });
    }

    document.addEventListener('click', (e) => {
      const dl = e.target.closest('[data-badge-dl]');
      const pr = e.target.closest('[data-badge-print]');
      if (!dl && !pr) return;
      const btn = dl || pr;
      const inModal = btn.closest('#badgeModalMount');
      const seat = inModal ? modalSeat : (g() && g().state.seat);
      if (dl) download(seat);
      else printBadge(seat);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalOpen) closeModal();
    });

    renderView(g() && g().state.seat);
  }

  window.GSBadge = {
    init,
    sync,
    renderView,
    openModal,
    closeModal,
    download,
    printBadge,
    preparePrint,
  };
}());
