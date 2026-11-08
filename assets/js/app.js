/* global APP_DATA */
(() => {
  'use strict';

  const A = APP_DATA;
  const COLS = A.meta.cols;
  const ROWS = A.meta.rows;
  const PALETTE = A.meta.palette;
  const CHARS = A.meta.chars;
  const COL_INDEX = {};
  COLS.forEach((c, i) => { COL_INDEX[c] = i; });
  const CHAR_INDEX = {};
  for (let i = 0; i < CHARS.length; i += 1) CHAR_INDEX[CHARS[i]] = i;
  const PAL_INDEX = new Map(PALETTE.map((h, i) => [h, i]));

  const SEATS = [];
  for (const r of ROWS) for (const c of COLS) SEATS.push(c + r);
  const SEAT_INDEX = new Map(SEATS.map((s, i) => [s, i]));

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
  const pct1 = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  const seatRow = (seat) => parseInt(seat.slice(1), 10);
  const seatCol = (seat) => seat[0];
  const codeLabel = (song) => 'CODE ' + song.showCode;
  const KIND_TH = { opening: 'เปิด', cheer: 'เชียร์', concept: 'คอนเซปต์', finale: 'เมดเล่ย์', outro: 'ปิด' };

  const ICONS = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.2c0-.85.94-1.37 1.67-.91l10.1 6.8c.67.45.67 1.44 0 1.89l-10.1 6.8A1.1 1.1 0 0 1 8 18.8z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4.4" width="4.3" height="15.2" rx="1.2"/><rect x="13.7" y="4.4" width="4.3" height="15.2" rx="1.2"/></svg>',
    caret: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  };

  /* Curated step -> lyric line mapping (line index, -1 = instrumental frame) */
  const LYRIC_SECTION = {
    1: [0, 0, 1, 1, 1, 1, 2, 3, 3],
    2: [0, 0, 0, 1, 1, 1, 2, 3, 7],
    3: [0, 0, 0, 0, 4, 4, 5, 5, 6, 5, 5, 6, 6, 3, 5, 6, 9],
    4: [0, 0, 0, 1, 1, 1, 2, 2],
    5: [0, 0, 0, 1, 1, 1, 2, 2, 2],
    6: [0, 0, 0, 0],
    7: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, -1],
    8: [0, 0, 0, 0, 0, 0, 1, 2],
    9: [5, 5, 7],
    10: [0, 0, 0, 0, 0],
  };

  /* Curated words to highlight in the lyric line for each code.  The word
     is rendered in the frame's accent colour instead of explaining the code
     in text.  Keys are step codes; values are exact substrings of the lyric
     line selected by LYRIC_SECTION. */
  const LYRIC_HIGHLIGHT = {
    // 1 · ขึ้นมือ G
    '1.7': ['เชียร์'],
    '1.8': ['สวัสดีค่ะ'],
    '1.9': ['สวัสดีครับ', 'สวัสดีค่ะ'],
    // 2 · กลอนโรงเรียน
    '2.1': ['น้อมหทัย'],
    '2.2': ['เทิดคุณค่า'],
    '2.3': ['สถาบัน'],
    '2.4': ['ขาวแดงนั้น'],
    '2.5': ['งามเรืองรอง'],
    '2.6': ['ผ่องศักดิ์ศรี'],
    '2.7': ['ร้อยใจภักดิ์', 'สามัคคี'],
    '2.8': ['สถาบัน', 'ที่แห่งนี้'],
    '2.9': ['ลัย'],
    // 3 · มาร์ช
    '3.1': ['วิริเยนฺ'],
    '3.2': ['ทุกขมจฺ'],
    '3.3': ['เจติ'],
    '3.4': ['คนล่วงทุกข์'],
    '3.5': ['พิริยาลัย'],
    '3.6': ['พิริยาลัย'],
    '3.11': ['ไว้'],
    '3.12': ['เปรียบ'],
    '3.13': ['เทียบ'],
    '3.14': ['ร่วมใจ'],
    '3.15': ['ประกาศศักดิ์ศรี'],
    '3.16': ['เทียบ'],
    '3.17': ['พิริยาลัย'],
    // 4 · พวกเรายิ่งใหญ่
    '4.1': ['พวกเรา', 'ยิ่งใหญ่', 'เกรียงไกร'],
    '4.2': ['ยืนยง', 'พงไพร'],
    '4.3': ['ดำรงคู่ฟ้า'],
    '4.4': ['กล้าหาญ'],
    '4.5': ['กล้าแกร่ง'],
    '4.6': ['มา'],
    '4.7': ['กว่า'],
    '4.8': ['ผู้ใด'],
    // 5 · เสียงกลองประชัน
    '5.1': ['เสียงกลองประจัญ'],
    '5.2': ['ฝ่าฟันมุ่งไป'],
    '5.3': ['ผ่านเพลงยิ่งใหญ่'],
    '5.4': ['ไม่เคยกลัวใคร'],
    '5.5': ['แม้ว่าผู้ใด'],
    '5.6': ['ก้าวสู้ต่อไป'],
    '5.7': ['ด้วยใจของเรา'],
    '5.8': ['สู้ด้วยหัวใจ'],
    '5.9': ['ด้วยใจของเรา'],
    // 6 · เอ้าวันเดียวกัน
    '6.1': ['วันเดียวกัน'],
    '6.2': ['ใจ'],
    '6.3': ['นึก'],
    '6.4': ['หวาดหวั่น'],
    // 7 · เอ้ามุ่งหน้าไป
    '7.1': ['ไป', 'พลัง'],
    '7.2': ['เปี่ยม'],
    '7.3': ['ความหวัง'],
    '7.4': ['ที่จะนำ'],
    '7.5': ['ชัยมา'],
    '7.6': ['เดินหน้า'],
    '7.7': ['ไป'],
    '7.8': ['ใจ'],
    '7.9': ['ผู้'],
    '7.10': ['คว้า'],
    '7.11': ['มา'],
    '7.12': ['ให้'],
    '7.13': ['เขียว'],
    // 8 · ไม่หวาดหวั่น
    '8.1': ['สีเขียว'],
    '8.2': ['ไม่หวาด'],
    '8.3': ['หวั่นใคร'],
    '8.4': ['บุกเข้าไป'],
    '8.5': ['เอาชิงเอาชัย'],
    '8.6': ['เบื้องหน้า'],
    '8.7': ['ศักดิ์ศรีของเรา'],
    '8.8': ['ต้องนำชัยมา'],
    // 9 · คอนเซปต์
    '9.1': ['คอนเซปต์ 1'],
    '9.2': ['คอนเซปต์ 1'],
    '9.3': ['คอนเซปต์ 2'],
    // 10 · เมดเล่ย์
    '10.1': ['พวกเรา'],
    '10.2': ['ไม่เกรง'],
    '10.3': ['ไม่กลัว'],
    '10.4': ['ต่ออัน'],
    '10.5': ['ตราย'],
  };

  /* ---------- palette classes ---------- */
  (function injectPalette() {
    const style = document.createElement('style');
    style.textContent = PALETTE.map((h, i) => `.p${i}{background-color:${h}}`).join('\n');
    document.head.appendChild(style);
  })();

  /* ---------- decode data ---------- */
  const songs = A.songs.map((song, si) => {
    let prev = null;
    const steps = song.steps.map((st, i) => {
      const pals = new Array(st.g.length);
      const colors = new Array(st.g.length);
      const counts = new Map();
      for (let k = 0; k < st.g.length; k += 1) {
        const p = CHAR_INDEX[st.g[k]] || 0;
        pals[k] = p;
        const h = PALETTE[p];
        colors[k] = h;
        counts.set(h, (counts.get(h) || 0) + 1);
      }
      const colored = 150 - (counts.get('#ffffff') || 0);
      const changed = i === 0 ? null : colors.reduce((n, h, k) => n + (h !== prev[k] ? 1 : 0), 0);
      prev = colors;
      return { ...st, si, i, pals, colors, counts, colored, changed, gi: 0 };
    });
    const theme = (song.theme && song.theme.length === 2) ? song.theme : ['#38bdf8', '#a78bfa'];
    return { ...song, si, theme, steps };
  });

  const flat = [];
  songs.forEach((song) => song.steps.forEach((st) => {
    st.gi = flat.length;
    flat.push(st);
  }));

  /* ---------- global analytics ---------- */
  const colorUsage = new Map(PALETTE.map((h) => [h, { cells: 0, frames: 0, songs: new Set() }]));
  const seatStats = SEATS.map(() => ({ colored: 0, counts: new Map() }));
  for (const song of songs) {
    for (const st of song.steps) {
      st.counts.forEach((n, h) => {
        const u = colorUsage.get(h);
        u.cells += n;
        u.frames += 1;
        u.songs.add(song.id);
      });
      for (let k = 0; k < 150; k += 1) {
        const h = st.colors[k];
        if (h !== '#ffffff') {
          seatStats[k].colored += 1;
          seatStats[k].counts.set(h, (seatStats[k].counts.get(h) || 0) + 1);
        }
      }
    }
  }

  const totalSteps = flat.length;
  const coloredSteps = flat.filter((s) => s.colored > 0).length;
  const totalColoredCells = flat.reduce((n, s) => n + s.colored, 0);
  const avgCoverage = pct1(totalColoredCells, totalSteps * 150);
  const uniquePatterns = new Set(flat.map((s) => s.g)).size;
  const mostUsed = Array.from(colorUsage.entries())
    .filter(([h]) => h !== '#ffffff')
    .sort((a, b) => b[1].cells - a[1].cells)[0];
  const biggestChange = flat.filter((s) => s.changed != null).sort((a, b) => b.changed - a.changed)[0];

  const byGrid = new Map();
  flat.forEach((st) => {
    if (!byGrid.has(st.g)) byGrid.set(st.g, []);
    byGrid.get(st.g).push(st);
  });
  const dupGroups = Array.from(byGrid.values()).filter((g) => g.length > 1)
    .sort((a, b) => b.length - a.length);
  const transitions = flat.filter((s) => s.changed != null)
    .sort((a, b) => b.changed - a.changed).slice(0, 10);

  /* ---------- helpers ---------- */
  function dominantPal(st) {
    let best = 0;
    let bestN = -1;
    st.counts.forEach((n, h) => {
      if (h === '#ffffff') return;
      if (n > bestN) { bestN = n; best = PAL_INDEX.get(h); }
    });
    return best;
  }
  function topColors(st, n) {
    return Array.from(st.counts.entries())
      .filter(([h]) => h !== '#ffffff')
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);
  }
  function miniHTML(pals, seatIdx) {
    let out = '';
    for (let k = 0; k < 150; k += 1) {
      out += `<span class="p${pals[k]}${k === seatIdx ? ' mseat' : ''}"></span>`;
    }
    return out;
  }
  function normalizeSeat(raw) {
    if (!raw) return null;
    const s = String(raw).toUpperCase().replace(/[\s_.\-]/g, '');
    const m = s.match(/^([A-O])(10|[1-9])$/);
    return m && SEAT_INDEX.has(m[1] + m[2]) ? m[1] + m[2] : null;
  }
  function setRange(el) {
    const min = Number(el.min) || 0;
    const max = Number(el.max) || 100;
    const p = ((Number(el.value) - min) / (max - min)) * 100;
    el.style.setProperty('--p', p + '%');
  }
  function heatColor(t) {
    const stops = [[24, 24, 27], [63, 63, 70], [113, 113, 122], [161, 161, 170], [228, 228, 231]];
    const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(x));
    const f = x - i;
    const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  function tile(v, k, s) {
    return `<div class="stat"><span class="stat-v">${v}</span><span class="stat-k">${esc(k)}</span>${s ? `<span class="stat-s">${esc(s)}</span>` : ''}</div>`;
  }
  function pageForCode(code) {
    const e = A.songbook.find((x) => x.code === code && x.status === 'file' && x.pageId);
    return e ? { id: e.pageId, step: e.stepIndex || 0 } : null;
  }

  /* ---------- contrast ----------
     ตัวอักษรบนช่องสี: พื้นสว่าง (ขาว เหลือง เขียวอ่อน ฟ้า) ใช้ตัวดำ,
     พื้นเข้ม (แดง น้ำเงิน ม่วง ดำ) ใช้ตัวขาว — ตามที่เจ้าของงานขอ */
  function srgbLin(v) {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * srgbLin((n >> 16) & 255)
      + 0.7152 * srgbLin((n >> 8) & 255)
      + 0.0722 * srgbLin(n & 255);
  }
  function readableText(hex) {
    return luminance(hex) > 0.28 ? '#0b0f16' : '#ffffff';
  }

  /* ---------- state ---------- */
  const SPEEDS = [{ ms: 1500, label: '0.6×' }, { ms: 950, label: '1×' }, { ms: 550, label: '1.8×' }];
  const state = {
    view: 'stand',
    si: 0,
    step: 0,
    seat: null,
    autoplay: false,
    speedIdx: 1,
    focusSeat: false,
    colorFocus: null,
    tlScope: 'all',
    gSong: 'all',
    gColored: false,
    gUnique: false,
    gSearch: '',
    standZoom: false,
    zoomBeforeFull: false,
    fsSession: false,
    theaterOff: false,
    codesOn: true,
    nextAdvanceAt: 0,
  };

  const seatIndex = () => (state.seat ? SEAT_INDEX.get(state.seat) : -1);
  let fullAttempt = 0;

  function readHash() {
    const raw = location.hash.replace(/^#/, '');
    if (!raw) return;
    let p;
    try { p = new URLSearchParams(raw); } catch (e) { return; }
    const v = p.get('view');
    if (['stand', 'songbook', 'gallery', 'analysis'].includes(v)) state.view = v;
    const s = parseInt(p.get('song'), 10);
    if (s >= 1 && s <= songs.length) state.si = s - 1;
    const st = parseInt(p.get('step'), 10);
    const max = songs[state.si].steps.length;
    if (st >= 1 && st <= max) state.step = st - 1;
    state.seat = normalizeSeat(p.get('seat'));
  }

  let hashTimer = null;
  function updateHash() {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(() => {
      const p = new URLSearchParams();
      p.set('view', state.view);
      p.set('song', String(state.si + 1));
      p.set('step', String(state.step + 1));
      if (state.seat) p.set('seat', state.seat);
      history.replaceState(null, '', '#' + p.toString());
    }, 120);
  }

  const curSong = () => songs[state.si];
  const curStep = () => songs[state.si].steps[state.step];

  /* ---------- toast ---------- */
  let toastTimer = null;
  function showToast(msg) {
    const el = $('#toast');
    el.innerHTML = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ---------- views ---------- */
  const APP_TITLE = 'คณะสีเขียว พิริยาลัย · Cheer Stand';
  const VIEW_META = {
    stand: { title: 'แสตนเชียร์', sub: `15 × 10 · ${flat.length} เฟรม` },
    songbook: { title: 'ใบเพลง', sub: `${songs.length} เพลง · ${A.songbook.length} ช่วง · ${flat.length} เฟรม` },
    gallery: { title: 'แกลเลอรี', sub: `ทุกเฟรม · ${flat.length}` },
    analysis: { title: 'วิเคราะห์', sub: `ภาพรวมทั้งงาน · ${songs.length} เพลง` },
  };

  function setView(v) {
    const changed = state.view !== v;
    state.view = v;
    if (v !== 'stand') {
      stopAuto();
      exitStageFullscreen();
    }
    $$('#navTabs [data-view], #bottomNav [data-view]').forEach((b) => {
      const active = b.dataset.view === v;
      b.classList.toggle('active', active);
      if (active) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    ['stand', 'songbook', 'gallery', 'analysis'].forEach((x) => {
      const el = $('#view-' + x);
      if (el) el.hidden = x !== v;
    });
    const meta = VIEW_META[v] || VIEW_META.stand;
    $('#pageTitle').textContent = meta.title;
    $('#pageSub').textContent = meta.sub;
    document.title = meta.title + ' · ' + APP_TITLE;
    if (changed) {
      const main = $('#appMain');
      if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
    }
    renderSongTabs();
    renderCurrentView();
    updatePlayerMode();
    updateHash();
  }

  function renderCurrentView() {
    if (state.view === 'stand') renderStandAll();
    else if (state.view === 'songbook') renderSongbook();
    else if (state.view === 'gallery') renderGallery();
    else renderAnalysis();
  }

  function openPage(pageId, stepIndex = 0) {
    const si = songs.findIndex((s) => s.id === pageId);
    if (si < 0) return;
    state.si = si;
    state.step = Math.max(0, Math.min(stepIndex, songs[si].steps.length - 1));
    setView('stand');
  }

  function goGlobal(gi) {
    const n = flat.length;
    const idx = ((gi % n) + n) % n;
    const st = flat[idx];
    state.si = st.si;
    state.step = st.i;
    if (state.view !== 'stand') setView('stand');
    else { renderStandAll(); updateHash(); }
  }

  function next() { goGlobal(curStep().gi + 1); }
  function prev() { goGlobal(curStep().gi - 1); }

  /* ---------- autoplay ---------- */
  let autoTimer = null;
  function updatePlayBtn() {
    const icon = state.autoplay ? ICONS.pause : ICONS.play;
    const label = state.autoplay ? 'หยุดเล่นอัตโนมัติ' : 'เล่นอัตโนมัติ';
    ['#btnPlay', '#mhPlay', '#thPlay', '#thCenterPlay'].forEach((sel) => {
      const btn = $(sel);
      if (!btn) return;
      btn.innerHTML = icon;
      btn.setAttribute('aria-label', label);
    });
    document.body.classList.toggle('is-playing', state.autoplay);
  }
  function stopAuto() {
    state.autoplay = false;
    state.nextAdvanceAt = 0;
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = null;
    updatePlayBtn();
    renderMyCard();
  }
  function startAuto() {
    stopAuto();
    state.autoplay = true;
    const ms = SPEEDS[state.speedIdx].ms;
    state.nextAdvanceAt = Date.now() + ms;
    autoTimer = setInterval(() => {
      state.nextAdvanceAt = Date.now() + ms;
      next();
    }, ms);
    updatePlayBtn();
    renderMyCard();
  }
  function toggleAuto() {
    if (state.autoplay) stopAuto();
    else startAuto();
  }

  /* ---------- song rail ---------- */
  function renderSongTabs() {
    const el = $('#songTabs');
    if (!el) return;
    el.innerHTML = songs.map((s) => `
      <button class="song-tab${s.si === state.si ? ' active' : ''}" data-song="${s.si}"
        style="--sa:${s.theme[0]};--sb:${s.theme[1]}">
        <span class="st-num">${String(s.id).padStart(2, '0')}</span>
        <span class="st-body">
          <span class="st-title">${esc(s.title)}</span>
          <span class="st-sub">CODE ${esc(s.showCode)} · ${s.steps.length} เฟรม</span>
        </span>
      </button>`).join('');
    updateRail('songTabs');
  }

  /* ---------- stand ---------- */
  const cellEls = [];
  function buildStandGrid() {
    const grid = $('#standGrid');
    let html = '<div class="glabel corner"></div>';
    COLS.forEach((c) => { html += `<div class="glabel col">${c}</div>`; });
    html += '<div class="glabel corner"></div>';
    ROWS.forEach((r) => {
      html += `<div class="glabel row-l">${r}</div>`;
      COLS.forEach((c) => {
        const seat = c + r;
        html += `<div class="seat-cell p0" data-seat="${seat}" role="gridcell" aria-label="ที่นั่ง ${seat}"><span class="slabel">${seat}</span></div>`;
      });
      html += `<div class="glabel row-r">${r}</div>`;
    });
    html += '<div class="glabel corner"></div>';
    COLS.forEach((c) => { html += `<div class="glabel col">${c}</div>`; });
    html += '<div class="glabel corner"></div>';
    grid.innerHTML = html;
    cellEls.length = 0;
    $$('.seat-cell', grid).forEach((el) => cellEls.push(el));
  }

  function paintStage() {
    const st = curStep();
    const seatIdx = seatIndex();
    const focusColor = state.colorFocus;
    for (let k = 0; k < 150; k += 1) {
      const el = cellEls[k];
      if (!el) continue;
      const p = st.pals[k];
      const hex = PALETTE[p];
      const meta = A.colors[hex] || { text: '#0f172a', short: '', name: '' };
      let cls = 'seat-cell p' + p;
      if (k === seatIdx) cls += ' selected';
      const seatDim = state.focusSeat && seatIdx >= 0 && k !== seatIdx;
      if (seatDim || (focusColor && hex !== focusColor)) cls += ' dimmed';
      el.className = cls;
      el.style.color = p === 0 ? 'rgba(11,15,22,.62)' : readableText(hex);
      el.setAttribute('aria-label', `ที่นั่ง ${SEATS[k]} สี${meta.short}`);
      el.title = `${SEATS[k]} · ${meta.name}`;
    }
  }

  function renderPlayer() {
    const song = curSong();
    const st = curStep();
    const card = $('#playerCard');
    card.style.setProperty('--sa', song.theme[0]);
    card.style.setProperty('--sb', song.theme[1]);
    $('#playerKicker').textContent = `SONG ${String(song.id).padStart(2, '0')} · ${codeLabel(song)}`;
    $('#playerTitle').textContent = song.title;
    const allWhite = song.steps.every((x) => x.colored === 0);
    $('#playerSub').textContent = song.subtitle + (allWhite ? ' · หน้านี้เป็นโพยลำดับ ไม่มีกริดสี' : '');
    $('#playerCode').textContent = st.code;
    $('#playerCounter').textContent = `เฟรม ${st.i + 1} / ${song.steps.length} · ทั้งงาน ${st.gi + 1}/${flat.length}`;
    const fsCode = $('#fsCode');
    if (fsCode) fsCode.textContent = `${st.code} · ${st.gi + 1}/${flat.length}`;
    const scrub = $('#scrub');
    scrub.max = String(flat.length);
    scrub.value = String(st.gi + 1);
    setRange(scrub);
    $('#btnSpeed').textContent = SPEEDS[state.speedIdx].label;
    const dom = dominantPal(st);
    $('#stepPills').innerHTML = song.steps.map((x, j) => `
      <button class="step-pill${j === st.i ? ' active' : ''}" data-i="${j}" title="${esc(x.name)}">
        <i style="background:${PALETTE[dominantPal(x)]}"></i>${x.code}
      </button>`).join('');
    $('#btnPlay').innerHTML = state.autoplay ? ICONS.pause : ICONS.play;
    updatePlayBtn();
    updateRail('stepPills');
    renderPlayerChrome();
  }

  /* ---------- player chrome (mini HUD + theater overlay) ---------- */
  function renderPlayerChrome() {
    const st = curStep();
    const total = flat.length;
    const pct = ((st.gi + 1) / total) * 100;
    const codeEls = [$('#mhCode'), $('#thCode')];
    codeEls.forEach((el) => { if (el) el.textContent = st.code; });
    const ticker = `เฟรม ${st.gi + 1} / ${total}`;
    const counters = [
      $('#mhCounter'), $('#thCounter'), $('#thTime'),
    ];
    counters.forEach((el) => { if (el) el.textContent = ticker; });
    const fill = $('#thFill');
    if (fill) fill.style.width = pct + '%';
    const knob = $('#thKnob');
    if (knob) knob.style.left = pct + '%';
    const track = $('#thTrack');
    if (track) {
      track.setAttribute('aria-valuemax', String(total));
      track.setAttribute('aria-valuenow', String(st.gi + 1));
    }
    const speed = $('#thSpeed');
    if (speed) speed.textContent = SPEEDS[state.speedIdx].label;
    const frameLabel = $('#myFrameLabel');
    if (frameLabel) frameLabel.textContent = `${st.code} · เฟรม ${st.gi + 1}/${total}`;
  }

  function lyricAccent(st) {
    const skip = new Set(['#ffffff', '#000000', '#999999', '#b7b7b7']);
    let best = '#548235';
    let bestN = -1;
    st.counts.forEach((n, h) => {
      if (skip.has(h)) return;
      if (n > bestN) { bestN = n; best = h; }
    });
    return best;
  }

  function lyricHTML(line, words, accent) {
    const meta = A.colors[accent] || { text: '#ffffff' };
    const ranges = [];
    (words || []).forEach((w) => {
      if (!w) return;
      let from = 0;
      while (from <= line.length) {
        const i = line.indexOf(w, from);
        if (i < 0) break;
        ranges.push([i, i + w.length]);
        from = i + w.length;
      }
    });
    ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    const merged = [];
    ranges.forEach(([s, e]) => {
      const last = merged[merged.length - 1];
      if (last && s <= last[1]) last[1] = Math.max(last[1], e);
      else merged.push([s, e]);
    });
    if (!merged.length) return esc(line);
    const text = meta.text || '#ffffff';
    let out = '';
    let cursor = 0;
    merged.forEach(([s, e]) => {
      out += esc(line.slice(cursor, s));
      out += `<mark class="lyric-hl" style="--hl:${accent};--hl-text:${text}">${esc(line.slice(s, e))}</mark>`;
      cursor = e;
    });
    out += esc(line.slice(cursor));
    return out;
  }

  function renderLyric() {
    const song = curSong();
    const st = curStep();
    const map = LYRIC_SECTION[song.id] || [];
    const li = map[st.i];
    const valid = Number.isInteger(li) && li >= 0 && li < (song.lyrics || []).length;
    const line = valid ? song.lyrics[li] : '';
    $('#lyricCode').textContent = st.code;
    $('#lyricCount').textContent = valid ? `ท่อน ${li + 1}/${song.lyrics.length}` : '';
    const html = valid ? lyricHTML(line, LYRIC_HIGHLIGHT[st.code] || [], lyricAccent(st)) : '';
    const lineEl = $('#lyricLine');
    lineEl.innerHTML = html || '— เฟรมแทรก ไม่มีคำร้อง —';
    lineEl.classList.toggle('is-empty', !valid);
    $('#lyricCue').textContent = st.cue || '—';
    /* subtitle ใน theater + เนื้อเพลงในการ์ดของฉัน */
    const sub = $('#thSub');
    if (sub) {
      sub.innerHTML = html;
      sub.classList.toggle('is-empty', !valid);
    }
    const mine = $('#myLyricLine');
    if (mine) mine.innerHTML = html || '— เฟรมแทรก ไม่มีคำร้อง —';
  }

  /* ---------- แผงของฉัน (portrait) ---------- */
  function seatNextInfo(idx) {
    const st = curStep();
    const hex = st.colors[idx];
    for (let gi = st.gi + 1; gi < flat.length; gi += 1) {
      const h = flat[gi].colors[idx];
      if (h !== hex) return { hex: h, frames: gi - st.gi };
    }
    return null;
  }

  function updateMyEta(next) {
    const el = $('#myEta');
    if (!el) return;
    if (!next) { el.textContent = ''; return; }
    if (!state.autoplay) {
      el.textContent = next.frames === 1 ? 'เปลี่ยนเฟรมถัดไป' : `อีก ${next.frames} เฟรม`;
      return;
    }
    const ms = SPEEDS[state.speedIdx].ms;
    const remain = state.nextAdvanceAt ? Math.max(0, state.nextAdvanceAt - Date.now()) : ms;
    const sec = ((next.frames - 1) * ms + remain) / 1000;
    el.textContent = sec < 0.35
      ? 'กำลังจะเปลี่ยน'
      : `เปลี่ยนในอีก ${sec < 10 ? sec.toFixed(1) : Math.round(sec)} วินาที`;
  }

  function renderMyCard() {
    const body = $('#myBody');
    if (!body) return;
    const card = $('#myCard');
    const label = $('#mySeatLabel');
    const idx = seatIndex();
    if (idx < 0) {
      card.classList.add('is-empty');
      body.hidden = true;
      if (label) label.textContent = 'ยังไม่เลือกที่นั่ง';
      return;
    }
    card.classList.remove('is-empty');
    body.hidden = false;
    const st = curStep();
    const hex = st.colors[idx];
    if (label) label.textContent = state.seat;
    const sw = $('#myNowSwatch');
    if (sw) {
      sw.style.backgroundColor = hex;
      sw.style.color = readableText(hex);
    }
    $('#myNowName').textContent = hex === '#ffffff' ? 'ขาว' : A.colors[hex].name;
    $('#myNowHex').textContent = hex.toUpperCase();
    const input = $('#myInput');
    if (input && document.activeElement !== input) input.value = state.seat;
    const next = seatNextInfo(idx);
    const nextSw = $('#myNextSw');
    if (!next) {
      nextSw.style.backgroundColor = 'transparent';
      $('#myNextName').textContent = 'ไม่มีอีกแล้ว';
      $('#myEta').textContent = '';
    } else {
      nextSw.style.backgroundColor = next.hex;
      $('#myNextName').textContent = next.hex === '#ffffff' ? 'ขาว' : A.colors[next.hex].name;
      updateMyEta(next);
    }
    renderPlayerChrome();
  }

  function renderColorSummary() {
    const st = curStep();
    const entries = Array.from(st.counts.entries()).sort((a, b) => {
      if (a[0] === '#ffffff') return 1;
      if (b[0] === '#ffffff') return -1;
      return b[1] - a[1];
    });
    const top = topColors(st, 1)[0];
    const note = `
      <div class="cssummary-note">
        <span>มีสี <b>${st.colored}/150</b> ที่นั่ง · <b>${pct1(st.colored, 150)}%</b></span>
        <span>${top ? 'สีเด่น: <b>' + esc(A.colors[top[0]].short) + '</b>' : 'เฟรมขาวล้วน'}</span>
      </div>`;
    const chips = entries.map(([hex, n]) => {
      const p = PAL_INDEX.get(hex);
      const active = state.colorFocus === hex ? ' active' : '';
      return `<button class="color-chip${active}" data-color="${hex}" title="คลิกเพื่อโฟกัสสีนี้">
        <span class="sw p${p}"></span>${esc(A.colors[hex].short)}<span class="cnt">${n}</span>
      </button>`;
    }).join('');
    const clear = state.colorFocus
      ? `<button class="color-clear" id="colorClear">ล้างโฟกัสสี</button>` : '';
    $('#colorSummary').innerHTML = note + chips + clear;
  }

  /* ---------- filmstrip ---------- */
  let filmKey = '';
  function renderFilmstrip() {
    const song = curSong();
    const seatIdx = seatIndex();
    const key = state.si + '|' + (state.seat || 'none');
    if (key !== filmKey) {
      filmKey = key;
      $('#filmstrip').innerHTML = song.steps.map((st) => `
        <button class="film-item" data-i="${st.i}" title="${esc(st.name)}">
          <div class="film-grid">${miniHTML(st.pals, seatIdx)}</div>
          <div class="film-meta"><span class="film-code">${st.code}</span></div>
          <div class="film-name">${esc(st.name)}</div>
        </button>`).join('');
    }
    $$('#filmstrip .film-item').forEach((el) => {
      el.classList.toggle('active', Number(el.dataset.i) === state.step);
    });
    $('#filmMeta').textContent = `${song.steps.length} เฟรม · คลิกเพื่อข้าม`;
    updateRail('filmstrip');
  }

  /* ---------- inspector ---------- */
  function renderInspector() {
    const st = curStep();
    const idx = seatIndex();
    const card = $('#inspectorCard');
    if (idx < 0) {
      card.classList.add('is-empty');
      const sw = $('#inspSwatch');
      sw.style.backgroundColor = 'transparent';
      sw.style.color = 'transparent';
      $('#inspSeat').textContent = '—';
      $('#inspPos').textContent = 'แตะที่นั่งบนผังเพื่อดูสี';
      $('#inspColorName').textContent = 'ยังไม่ได้เลือก';
      $('#inspHex').textContent = '';
      $('#inspFrame').textContent = '—';
      $('#inspRowFromStage').textContent = '—';
      $('#inspColoredFrames').textContent = '—';
      $('#inspChanged').textContent = '—';
      $('#inspCue').textContent = '—';
      $('#inspChange').innerHTML = '<span>เลือกที่นั่งเพื่อดูการเปลี่ยนสีทีละเฟรม</span>';
      $('#seatInput').value = '';
      syncSeatControls();
      return;
    }
    card.classList.remove('is-empty');
    const hex = st.colors[idx];
    const meta = A.colors[hex];
    const sw = $('#inspSwatch');
    sw.style.backgroundColor = hex;
    sw.style.color = hex === '#ffffff' ? '#0f172a' : meta.text;
    $('#inspSeat').textContent = state.seat;
    $('#inspPos').textContent = `คอลัมน์ ${seatCol(state.seat)} · แถว ${seatRow(state.seat)}`;
    $('#inspColorName').textContent = meta.name;
    $('#inspHex').textContent = hex.toUpperCase();
    $('#inspFrame').textContent = st.code;
    const fromStage = 10 - seatRow(state.seat);
    $('#inspRowFromStage').textContent = fromStage === 0 ? 'ติดเวที' : `${fromStage} แถว`;
    $('#inspColoredFrames').textContent = `${seatStats[idx].colored} / ${flat.length}`;

    const hasPrev = st.i > 0;
    const prevSt = hasPrev ? songs[state.si].steps[st.i - 1] : null;
    const prevHex = prevSt ? prevSt.colors[idx] : null;
    const same = prevHex === hex;
    $('#inspChanged').textContent = !hasPrev ? 'เริ่มหน้า' : (same ? 'สีเดิม' : 'เปลี่ยน');
    if (!hasPrev) {
      $('#inspChange').innerHTML = '<span>เฟรมแรกของหน้านี้</span>';
    } else {
      $('#inspChange').innerHTML = `
        <span>ก่อนหน้า</span>
        <span class="sw p${PAL_INDEX.get(prevHex)}"></span>
        <span class="arrow">→</span>
        <span class="sw p${PAL_INDEX.get(hex)}"></span>
        <span>${same ? 'สีเดิม' : esc(A.colors[prevHex].short) + ' → ' + esc(meta.short)}</span>`;
    }
    $('#inspCue').textContent = st.cue || '—';
    $('#seatInput').value = state.seat;
    syncSeatControls();
  }

  function syncSeatControls() {
    const has = Boolean(state.seat);
    const clear = $('#inspClear');
    if (clear) clear.hidden = !has;
    const copy = $('#btnCopy');
    if (copy) copy.disabled = !has;
    const focus2 = $('#btnFocus2');
    if (focus2) focus2.disabled = !has;
    if (!has) {
      state.focusSeat = false;
      const focus1 = $('#btnFocus');
      if (focus1) focus1.classList.remove('active');
      if (focus2) focus2.classList.remove('active');
    }
  }

  /* ---------- timeline ---------- */
  function renderTimeline() {
    const idx = seatIndex();
    if (idx < 0) {
      $('#tlSummary').textContent = 'ยังไม่ได้เลือก';
      $('#tlColors').innerHTML = '';
      $('#tlList').innerHTML = '<div class="tl-empty">เลือกที่นั่งเพื่อดูไทม์ไลน์สีทุกเฟรม</div>';
      return;
    }
    const stats = seatStats[idx];
    $('#tlSummary').textContent = `${stats.colored}/${flat.length} เฟรมมีสี`;
    const colors = Array.from(stats.counts.entries()).sort((a, b) => b[1] - a[1]);
    const colorChips = colors.map(([hex, n]) => `
      <span class="tl-color"><span class="sw p${PAL_INDEX.get(hex)}"></span>${esc(A.colors[hex].short)} <b>${n}</b></span>`).join('');
    const whiteN = flat.length - stats.colored;
    $('#tlColors').innerHTML = colorChips + (whiteN ? `<span class="tl-color"><span class="sw p0"></span>ขาว <b>${whiteN}</b></span>` : '');

    const groups = state.tlScope === 'song' ? [curSong()] : songs;
    let html = '';
    for (const song of groups) {
      const rows = [];
      for (const st of song.steps) {
        const hex = st.colors[idx];
        if (state.tlScope === 'colored' && hex === '#ffffff') continue;
        const active = song.si === state.si && st.i === state.step ? ' active' : '';
        rows.push(`
          <div class="tl-row${active}" data-gi="${st.gi}" title="${esc(st.name)}">
            <span class="sw p${st.pals[idx]}"></span>
            <span class="code">${st.code}</span>
            <span class="nm">${esc(st.name)}</span>
            <span class="cn">${esc(A.colors[hex].short)}</span>
          </div>`);
      }
      if (!rows.length) continue;
      html += `<div class="tl-song" style="--sa:${song.theme[0]}"><span class="n">${String(song.id).padStart(2, '0')}</span> ${esc(song.title)}</div>${rows.join('')}`;
    }
    const list = $('#tlList');
    list.innerHTML = html || '<div class="tl-empty">ไม่มีเฟรมที่มีสีในหน้านี้</div>';
    const activeEl = list.querySelector('.tl-row.active');
    if (activeEl) {
      const top = activeEl.offsetTop - list.offsetTop;
      if (top < list.scrollTop || top > list.scrollTop + list.clientHeight - 46) {
        list.scrollTop = Math.max(0, top - list.clientHeight / 2);
      }
    }
  }

  /* ---------- focus ---------- */
  function updateFocusBanner() {
    const b = $('#focusBanner');
    const parts = [];
    if (state.colorFocus) parts.push('สี ' + A.colors[state.colorFocus].short);
    if (state.focusSeat && state.seat) parts.push('ที่นั่ง ' + state.seat);
    if (!parts.length) { b.classList.remove('show'); return; }
    b.classList.add('show');
    $('#focusBannerText').innerHTML = 'กำลังโฟกัส: <b>' + esc(parts.join(' · ')) + '</b>';
  }
  function setSeatFocus(on) {
    if (on && !state.seat) {
      showToast('เลือกที่นั่งก่อนโฟกัส');
      syncSeatControls();
      return;
    }
    state.focusSeat = on && Boolean(state.seat);
    $('#btnFocus').classList.toggle('active', state.focusSeat);
    $('#btnFocus2').classList.toggle('active', state.focusSeat);
    paintStage();
    updateFocusBanner();
  }
  function setColorFocus(hex) {
    state.colorFocus = state.colorFocus === hex ? null : hex;
    paintStage();
    renderColorSummary();
    updateFocusBanner();
  }

  function renderStandAll() {
    renderSongTabs();
    renderPlayer();
    renderLyric();
    paintStage();
    renderColorSummary();
    renderFilmstrip();
    renderInspector();
    renderTimeline();
    renderMyCard();
    updateFocusBanner();
    requestAnimationFrame(() => updateRail('standWrap'));
  }

  /* ---------- selection ---------- */
  function refreshSeatUI() {
    syncSeatControls();
    if (state.view === 'stand') {
      paintStage();
      renderInspector();
      renderTimeline();
      renderFilmstrip();
      renderMyCard();
      updateFocusBanner();
    } else if (state.view === 'gallery') {
      renderGallery();
    } else if (state.view === 'analysis') {
      updateAnalysisSelection();
    }
  }

  function selectSeat(raw, opts = {}) {
    const seat = normalizeSeat(raw);
    if (!seat) return false;
    if (state.seat === seat && !opts.force) {
      clearSeat();
      return true;
    }
    state.seat = seat;
    refreshSeatUI();
    updateHash();
    return true;
  }

  function clearSeat() {
    state.seat = null;
    state.focusSeat = false;
    const focus1 = $('#btnFocus');
    if (focus1) focus1.classList.remove('active');
    const focus2 = $('#btnFocus2');
    if (focus2) focus2.classList.remove('active');
    refreshSeatUI();
    updateHash();
  }

  function handleQuickSearch(raw) {
    const v = String(raw || '').trim();
    const seat = normalizeSeat(v);
    if (seat) {
      selectSeat(seat, { force: true });
      setView('stand');
      showToast('ไปที่ที่นั่ง <b>' + seat + '</b>');
      $('#quickSeat').value = '';
      return;
    }
    const n = parseInt(v.replace(/[^\d]/g, ''), 10);
    if (n >= 1 && n <= flat.length) {
      goGlobal(n - 1);
      setView('stand');
      const st = flat[n - 1];
      showToast('ไปที่เฟรม <b>' + n + '</b> · ' + esc(st.code) + ' ' + esc(st.name));
      return;
    }
    showToast('พิมพ์ที่นั่ง เช่น E6 หรือเลขเฟรม 1–' + flat.length);
  }

  /* ---------- gallery ---------- */
  function renderGallery() {
    const seatIdx = seatIndex();
    const q = state.gSearch.trim().toLowerCase();
    const list = state.gSong === 'all' ? songs : [songs[Number(state.gSong)]];
    let total = 0;
    let html = '';
    for (const song of list) {
      if (!song) continue;
      let steps = song.steps.filter((st) => {
        if (state.gColored && st.colored === 0) return false;
        if (q && !(`${st.code} ${st.name} ${st.cue}`.toLowerCase().includes(q))) return false;
        return true;
      });
      if (state.gUnique) {
        const seen = new Set();
        steps = steps.filter((st) => {
          if (seen.has(st.g)) return false;
          seen.add(st.g);
          return true;
        });
      }
      if (!steps.length) continue;
      total += steps.length;
      const coloredCount = song.steps.filter((s) => s.colored > 0).length;
      const avg = pct1(song.steps.reduce((n, s) => n + s.colored, 0), song.steps.length * 150);
      const cards = steps.map((st) => {
        const group = byGrid.get(st.g) || [];
        const dup = group.length > 1 && st.colored > 0
          ? `<span class="dup-badge">รูปแบบซ้ำ ×${group.length}</span>` : '';
        const chips = topColors(st, 4).map(([hex]) => (
          `<span class="cs p${PAL_INDEX.get(hex)}" title="${esc(A.colors[hex].name)}"></span>`
        )).join('');
        const extra = topColors(st, 99).length > 4
          ? `<span class="more">+${topColors(st, 99).length - 4}</span>` : '';
        return `
          <article class="gcard" data-gi="${st.gi}" style="--sa:${song.theme[0]};--sb:${song.theme[1]}">
            <div class="mini-wrap">
              ${dup}
              <div class="mini">${miniHTML(st.pals, seatIdx)}</div>
              <span class="gcard-open">เปิดดู →</span>
            </div>
            <div class="gcard-meta"><span class="gcode">${st.code}</span><span class="gcov">มีสี ${st.colored}/150 · ${pct1(st.colored, 150)}%</span></div>
            <h4>${esc(st.name)}</h4>
            <p class="gcue">${esc(st.cue || '—')}</p>
            <div class="gchips">${chips}${extra}</div>
          </article>`;
      }).join('');
      html += `
        <section class="gallery-song" style="--sa:${song.theme[0]};--sb:${song.theme[1]}">
          <div class="gallery-song-head">
            <span class="num">${String(song.id).padStart(2, '0')}</span>
            <div>
              <h3>${esc(song.title)}</h3>
              <p>${codeLabel(song)} · ${esc(song.subtitle)}</p>
            </div>
            <div class="chips">
              <span class="sp-stat"><b>${song.steps.length}</b> เฟรม</span>
              <span class="sp-stat"><b>${coloredCount}</b> มีสี</span>
              <span class="sp-stat">เฉลี่ย <b>${avg}%</b></span>
            </div>
          </div>
          <div class="gallery-grid">${cards}</div>
        </section>`;
    }
    $('#galleryContainer').innerHTML = html
      || '<div class="card" style="padding:40px;text-align:center;color:var(--text-3)">ไม่พบเฟรมที่ตรงกับตัวกรอง</div>';
    $('#gCount').textContent = `${total} เฟรม`;
    const sel = $('#gSong');
    if (sel.value !== state.gSong) sel.value = state.gSong;
    $('#gColored').checked = state.gColored;
    $('#gUnique').checked = state.gUnique;
  }

  /* ---------- songbook ---------- */
  function renderSongbook() {
    $('#songbookHero').innerHTML = `
      <div class="stat-strip">
        ${tile('17', 'โค้ด', 'OPEN → ปิด')}
        ${tile(String(songs.length), 'หน้าแสตน', 'มีกริด')}
        ${tile(String(flat.length), 'เฟรม', 'ตามลำดับรัน')}
        ${tile('6', 'โค้ดไม่มีกริด', '1, 5, 11–13, 16')}
        ${tile(String(A.songbook.length), 'ช่วงในใบเพลง', 'เปิด → ปิด')}
      </div>`;

    const flow = A.songbook.filter((x) => x.kind !== 'outro');
    $('#songbookFlow').innerHTML = flow.map((x) => {
      const has = x.status === 'file';
      const label = x.order === 'OPEN' ? 'เปิด' : x.order;
      return `<button class="prog-card ${has ? 'has-file' : 'no-file'}"
        ${has ? `data-page="${x.pageId}" data-step="${x.stepIndex || 0}"` : 'type="button"'}>
        <div class="prog-top">
          <span class="prog-code">${label === 'เปิด' ? 'OPEN' : 'CODE ' + esc(x.code)}</span>
          <span class="prog-status ${has ? 'ok' : 'no'}">${has ? 'มีไฟล์' : 'ไม่มีไฟล์'}</span>
        </div>
        <h4>${esc(x.title)}</h4>
        <p>${esc(x.cues.slice(0, 2).join(' · '))}</p>
      </button>`;
    }).join('');
    $('#flowMeta').textContent = flow.length + ' ช่วง';

    $('#songbookList').innerHTML = A.songbook.map((x) => {
      const has = x.status === 'file';
      const order = x.order === 'OPEN' ? 'เปิด' : x.order === 'OUT' ? 'จบ' : x.order;
      return `<article class="sb-card ${has ? 'has-file' : 'no-file'}">
        <div class="sb-head">
          <span class="sb-order">${order}</span>
          <div class="sb-title">
            <h3>${esc(x.title)}</h3>
            <p>CODE ${esc(x.code)} · ${KIND_TH[x.kind] || ''}</p>
          </div>
          <span class="prog-status ${has ? 'ok' : 'no'}">${has ? 'มีไฟล์แสตน' : 'ไม่มีไฟล์'}</span>
          ${has ? `<button class="sb-open" data-page="${x.pageId}" data-step="${x.stepIndex || 0}">เปิดแสตน</button>` : ''}
        </div>
        <div class="sb-body">
          <div class="sb-lyrics">${x.lyrics.map((l) => `<p>${esc(l)}</p>`).join('')}</div>
          <div class="sb-side">
            <div class="sb-cues">${x.cues.map((c) => `<span class="cue-chip">${esc(c)}</span>`).join('')}</div>
            <p class="sb-note">${esc(x.note)}</p>
          </div>
        </div>
      </article>`;
    }).join('');
  }

  /* ---------- analysis ---------- */
  function renderAnalysis() {
    const heatMax = Math.max(...seatStats.map((s) => s.colored));
    const heatMin = Math.min(...seatStats.map((s) => s.colored));
    const songPanels = songs.map((song) => {
      const totals = new Map();
      song.steps.forEach((st) => st.counts.forEach((n, h) => totals.set(h, (totals.get(h) || 0) + n)));
      const totalCells = song.steps.length * 150;
      const dist = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
      const coloredFrames = song.steps.filter((s) => s.colored > 0).length;
      const avg = pct1(song.steps.reduce((n, s) => n + s.colored, 0), totalCells);
      const uniq = new Set(song.steps.map((s) => s.g)).size;
      const distBar = dist.map(([hex, n]) => (
        `<i class="p${PAL_INDEX.get(hex)}" style="width:${(n / totalCells) * 100}%;opacity:${hex === '#ffffff' ? 0.35 : 1}"></i>`
      )).join('');
      const distLegend = dist.filter(([h]) => h !== '#ffffff').slice(0, 8).map(([hex, n]) => (
        `<span class="dl"><span class="sw p${PAL_INDEX.get(hex)}"></span>${esc(A.colors[hex].short)} <b>${n}</b></span>`
      )).join('') + `<span class="dl"><span class="sw p0"></span>ขาว <b>${totals.get('#ffffff') || 0}</b></span>`;

      const bars = song.steps.map((st) => {
        const v = st.changed == null ? 0 : st.changed;
        return `<span class="bar${v === 0 ? ' zero' : ''}" style="height:${Math.max(4, (v / 150) * 100)}%" title="${st.code} · เปลี่ยน ${v}/150"></span>`;
      }).join('');

      const rows = song.steps.map((st) => {
        const coverage = pct1(st.colored, 150);
        const dom = dominantPal(st);
        return `<div class="astep" data-gi="${st.gi}" role="button" tabindex="0">
          <span class="ac">${st.code}</span>
          <span class="an"><b>${esc(st.name)}</b><span>${esc(st.cue || '—')}</span></span>
          <span class="acov"><span class="track"><span class="fill" style="width:${coverage}%"></span></span><span class="apct">${coverage}%</span></span>
          <span class="ach">${st.changed == null ? '—' : `<b>±${st.changed}</b>`}</span>
          <span class="adot p${dom}"></span>
        </div>`;
      }).join('');

      const lyrics = (song.lyrics || []).map((l) => `<p>${esc(l)}</p>`).join('');
      return `<details class="song-panel" style="--sa:${song.theme[0]};--sb:${song.theme[1]}" ${song.si === state.si ? 'open' : ''}>
        <summary>
          <span class="sp-num">${String(song.id).padStart(2, '0')}</span>
          <span class="sp-title"><h4>${esc(song.title)}</h4><p>${codeLabel(song)} · ${esc(song.subtitle)}</p></span>
          <span class="sp-stats">
            <span class="sp-stat"><b>${song.steps.length}</b> เฟรม</span>
            <span class="sp-stat"><b>${coloredFrames}</b> มีสี</span>
            <span class="sp-stat">เฉลี่ย <b>${avg}%</b></span>
            <span class="sp-stat">ไม่ซ้ำ <b>${uniq}</b></span>
          </span>
          <span class="sp-caret">${ICONS.caret}</span>
        </summary>
        <div class="song-body">
          <p class="song-desc">${esc(song.desc)}</p>
          <details class="lyric-box">
            <summary>เนื้อเพลง / โน้ตจากใบเพลง <span>${esc(song.notation)}</span></summary>
            <div class="lyric-lines">${lyrics}</div>
          </details>
          <div class="distbar">${distBar}</div>
          <div class="distlegend">${distLegend}</div>
          <div class="tchart">${bars}</div>
          <div class="tchart-note"><span>การเปลี่ยนแปลงระหว่างเฟรม (สูง = เปลี่ยนมาก)</span><span>${song.steps.length} เฟรม</span></div>
          <div class="step-list">${rows}</div>
        </div>
      </details>`;
    }).join('');

    const heatCells = ROWS.map((r) => {
      let line = `<div class="glabel row-l">${r}</div>`;
      COLS.forEach((c) => {
        const seat = c + r;
        const k = SEAT_INDEX.get(seat);
        const n = seatStats[k].colored;
        const t = heatMax ? n / heatMax : 0;
        const text = t > 0.55 ? '#09090b' : '#e4e4e7';
        line += `<div class="heat-cell${seat === state.seat ? ' selected' : ''}" data-seat="${seat}"
          style="background:${heatColor(t)};color:${text}" title="${seat} · ${n}/${flat.length} เฟรมมีสี">${n}</div>`;
      });
      line += `<div class="glabel row-r">${r}</div>`;
      return line;
    }).join('');

    const colorCards = Array.from(colorUsage.entries())
      .sort((a, b) => b[1].cells - a[1].cells)
      .map(([hex, u]) => {
        const c = A.colors[hex];
        const p = PAL_INDEX.get(hex);
        return `<button class="cd-card" data-color="${hex}" title="คลิกเพื่อโฟกัสสีนี้บนแสตน">
          <div class="cd-strip p${p}"></div>
          <div class="cd-body">
            <h4>${esc(c.name)}<span class="cd-hex">${hex.toUpperCase()}</span></h4>
            <div class="cd-stats"><span><b>${u.cells}</b> ช่อง</span><span><b>${u.frames}</b> เฟรม</span><span><b>${u.songs.size}</b> หน้า</span></div>
            <p class="cd-desc">${esc(c.desc)}</p>
          </div>
        </button>`;
      }).join('');

    const trCards = transitions.map((st) => {
      const song = songs[st.si];
      const prevSt = song.steps[st.i - 1];
      const from = dominantPal(prevSt);
      const to = dominantPal(st);
      const sameDom = from === to;
      const pct = pct1(st.changed, 150);
      return `<div class="tr-card">
        <div class="tr-top">
          <span class="sw p${from}"></span><span class="ar">→</span><span class="sw p${to}"></span>
          <span class="n">±${st.changed}/150</span>
        </div>
        <h4>${esc(song.title)} · ${st.code} ${esc(st.name)}</h4>
        <p>${sameDom
          ? `สีเด่นเดิม ${esc(A.colors[PALETTE[from]].short)} · สลับตำแหน่ง ${pct}% ของแสตน`
          : `${esc(A.colors[PALETTE[from]].short)} → ${esc(A.colors[PALETTE[to]].short)} · ${pct}% ของแสตน`}</p>
        <div class="tr-bar"><i style="width:${pct}%"></i></div>
      </div>`;
    }).join('');

    const dupCards = dupGroups.map((arr) => {
      const white = arr.every((s) => s.colored === 0);
      const codes = arr.map((s) => `<span class="dup-code">${s.code}</span>`).join('');
      if (white) {
        return `<div class="dup-card">
          <h4>ขาวล้วน <span>${arr.length} เฟรม</span></h4>
          <p style="margin:4px 0 0;font-size:9px;color:var(--text-3)">เฟรมที่ไม่มีสี — ใช้สะบัด/ก้ม/นิ่ง หรือเป็นโพยลำดับ</p>
          <div class="dup-codes">${codes}</div>
        </div>`;
      }
      const sw = topColors(arr[0], 6).map(([hex]) => `<i class="p${PAL_INDEX.get(hex)}"></i>`).join('');
      return `<div class="dup-card">
        <h4>รูปแบบเดียวกัน <span>${arr.length} เฟรม</span></h4>
        <div class="dup-swatches">${sw}</div>
        <div class="dup-codes">${codes}</div>
      </div>`;
    }).join('');

    const equipRows = A.equipment.map((e) => {
      let status;
      if (e.use === 0) status = '<span class="badge">ไม่ใช้</span>';
      else if (e.use == null) status = `<span class="badge ${e.ok ? 'ok' : 'warn'}">${e.ok ? 'ใช้มือ' : 'ไม่ระบุ'}</span>`;
      else status = `<span class="badge ${e.ok ? 'ok' : 'warn'}">${e.ok ? 'พร้อม' : 'ยังไม่ครบ'}</span>`;
      return `
      <tr>
        <td class="mono">${esc(e.code)}</td>
        <td>${esc(e.name)}</td>
        <td class="num">${e.use == null ? '—' : e.use}</td>
        <td class="num">${e.ready == null ? '—' : e.ready}</td>
        <td>${status}</td>
      </tr>`;
    }).join('');

    const programCards = A.program.map((p) => {
      const page = pageForCode(p.code);
      const has = p.status === 'file';
      return `<button class="prog-card ${has ? 'has-file' : 'no-file'}"
        ${page ? `data-page="${page.id}" data-step="${page.step}"` : 'type="button"'}>
        <div class="prog-top">
          <span class="prog-code">CODE ${esc(p.code)}</span>
          <span class="prog-status ${has ? 'ok' : 'no'}">${has ? 'มีไฟล์' : 'ไม่มีไฟล์'}</span>
        </div>
        <h4>${esc(p.title)}</h4>
        <p>${esc(p.note || p.file || '')}</p>
      </button>`;
    }).join('');

    const hero = `
      <div class="stat-strip">
        ${tile(String(songs.length), 'หน้าแสตน')}
        ${tile(String(flat.length), 'เฟรม')}
        ${tile('150', 'ที่นั่ง')}
        ${tile('20', 'สี')}
        ${tile(avgCoverage + '%', 'เฉลี่ยมีสี')}
        ${tile(String(coloredSteps), 'เฟรมมีสี')}
        ${tile(String(uniquePatterns), 'รูปแบบไม่ซ้ำ')}
        ${tile('±' + biggestChange.changed, 'เปลี่ยนมากสุด', biggestChange.code)}
      </div>`;

    const analysisHTML = `
      ${hero}
      <section class="an-section">
        <div class="section-head"><h3>แผนที่โปรแกรม 17 โค้ด</h3></div>
        <div class="program-grid">${programCards}</div>
      </section>

      <section class="an-section">
        <div class="section-head"><h3>ฮีตแมปที่นั่ง</h3><span class="section-meta">${flat.length} เฟรม</span></div>
        <div class="panel heat-card">
          <div class="panel-head stage-head"><span class="stage-label">เวที · STAGE</span><div class="stage-tools"><span class="sp-stat">สูงสุด <b>${heatMax}/${flat.length}</b></span><span class="sp-stat">ต่ำสุด <b>${heatMin}</b></span></div></div>
          <div class="heat-grid" id="heatGrid">
            <div class="glabel corner"></div>${COLS.map((c) => `<div class="glabel col">${c}</div>`).join('')}<div class="glabel corner"></div>
            ${heatCells}
            <div class="glabel corner"></div>${COLS.map((c) => `<div class="glabel col">${c}</div>`).join('')}<div class="glabel corner"></div>
          </div>
          <div class="stage-label bottom">ผู้ชม · AUDIENCE</div>
          <div class="heat-legend">
            <span class="lab">0</span><span class="bar"></span><span class="lab">${heatMax}</span>
            <span class="hl" id="heatSeatInfo"></span>
          </div>
        </div>
      </section>

      <section class="an-section">
        <div class="section-head"><h3>วิเคราะห์รายหน้า</h3></div>
        ${songPanels}
      </section>

      <section class="an-section">
        <div class="section-head"><h3>พจนานุกรมสี</h3><span class="section-meta">20 สี</span></div>
        <div class="color-dict">${colorCards}</div>
      </section>

      <section class="an-section">
        <div class="section-head"><h3>การเปลี่ยนแปลงที่ใหญ่ที่สุด</h3></div>
        <div class="tr-list">${trCards}</div>
      </section>

      <section class="an-section">
        <div class="section-head"><h3>รูปแบบซ้ำ</h3></div>
        <div class="dup-grid">${dupCards}</div>
      </section>

      <section class="an-section">
        <div class="section-head"><h3>อุปกรณ์ประกอบ</h3><span class="section-meta">${A.equipment.length} รายการ</span></div>
        <div class="equip-summary">
          <span class="sp-stat">พร้อม <b>${A.equipment.filter((e) => e.ok).length}</b></span>
          <span class="sp-stat">ต้องตรวจ <b>${A.equipment.filter((e) => !e.ok).length}</b></span>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>โค้ด</th><th>อุปกรณ์</th><th>ใช้งาน</th><th>พร้อม</th><th>สถานะ</th></tr></thead>
            <tbody>${equipRows}</tbody>
          </table>
        </div>
      </section>`;

    $('#analysisContainer').innerHTML = analysisHTML;
    updateAnalysisSelection();
  }

  function updateAnalysisSelection() {
    const idx = seatIndex();
    $$('#heatGrid .heat-cell').forEach((el) => {
      el.classList.toggle('selected', Boolean(state.seat) && el.dataset.seat === state.seat);
    });
    const info = $('#heatSeatInfo');
    if (!info) return;
    if (idx < 0) {
      info.textContent = 'ยังไม่ได้เลือกที่นั่ง · แตะช่องเพื่อดู';
      return;
    }
    info.innerHTML = `เลือก <b>${state.seat}</b> · มีสี ${seatStats[idx].colored}/${flat.length} เฟรม`;
  }

  /* ---------- copy cue sheet ---------- */
  async function copyCueSheet() {
    const idx = seatIndex();
    if (idx < 0) {
      showToast('เลือกที่นั่งก่อนคัดลอกโพย');
      return;
    }
    const lines = [];
    lines.push('โพยสีส่วนตัว · คณะสีเขียว พิริยาลัย');
    lines.push(`ที่นั่ง ${state.seat} (คอลัมน์ ${seatCol(state.seat)} · แถว ${seatRow(state.seat)} · ห่างเวที ${10 - seatRow(state.seat)} แถว)`);
    lines.push(`${A.show.event} · ${A.show.title}`);
    lines.push('————————————————————————');
    songs.forEach((song) => {
      lines.push('');
      lines.push(`[${song.id}] ${song.title}  (CODE ${song.showCode})`);
      song.steps.forEach((st) => {
        const hex = st.colors[idx];
        const short = hex === '#ffffff' ? 'ขาว' : A.colors[hex].short;
        lines.push(`  ${st.code.padEnd(5)} ${st.name} — ${short}`);
      });
    });
    lines.push('');
    lines.push(`รวม ${flat.length} เฟรม · ที่นั่งนี้มีสี ${seatStats[idx].colored} เฟรม`);
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      showToast(`คัดลอกโพยของ <b>${state.seat}</b> แล้ว · ${flat.length} เฟรม`);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (err) { /* ignore */ }
      ta.remove();
      showToast(`คัดลอกโพยของ <b>${state.seat}</b> แล้ว`);
    }
  }

  /* ---------- fullscreen + zoom ---------- */
  function isStageFull() {
    return Boolean(document.fullscreenElement) || $('#stageCard').classList.contains('expanded');
  }

  function setZoom(on) {
    state.standZoom = on;
    const card = $('#stageCard');
    if (card) card.classList.toggle('zoomed', on);
    const btn = $('#btnZoom');
    if (btn) {
      btn.textContent = on ? 'พอดีจอ' : 'ขยาย';
      btn.setAttribute('aria-pressed', String(on));
    }
    requestAnimationFrame(() => updateRail('standWrap'));
  }

  function syncFullBtn() {
    const btn = $('#btnFull');
    if (!btn) return;
    const full = isStageFull();
    btn.classList.toggle('active', full);
    btn.setAttribute('aria-label', full ? 'ออกจากเต็มจอ' : 'ขยายเต็มจอ');
    btn.title = full ? 'ออกจากเต็มจอ' : 'ขยายเต็มจอ';
    requestAnimationFrame(() => updateRail('standWrap'));
  }

  function enterExpanded() {
    const card = $('#stageCard');
    if (!card) return;
    card.classList.add('expanded');
    document.body.classList.add('stage-expanded');
    syncFullBtn();
    updatePlayerMode();
  }

  function exitStageFullscreen() {
    fullAttempt += 1;
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    const card = $('#stageCard');
    if (card) card.classList.remove('expanded');
    document.body.classList.remove('stage-expanded');
    state.fsSession = false;
    state.zoomBeforeFull = false;
    syncFullBtn();
    updatePlayerMode();
  }

  function toggleFull() {
    const card = $('#stageCard');
    if (!card) return;
    if (document.fullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      return;
    }
    if (card.classList.contains('expanded')) {
      exitStageFullscreen();
      return;
    }
    state.fsSession = true;
    const attempt = ++fullAttempt;
    if (card.requestFullscreen) {
      try {
        card.requestFullscreen().catch(() => { if (attempt === fullAttempt) enterExpanded(); });
        setTimeout(() => {
          if (attempt === fullAttempt && !document.fullscreenElement && !card.classList.contains('expanded')) {
            enterExpanded();
          }
        }, 700);
      } catch (e) {
        enterExpanded();
      }
    } else {
      enterExpanded();
    }
    syncFullBtn();
    updatePlayerMode();
  }

  /* ---------- rail scrollers ---------- */
  function updateRail(id) {
    const target = document.getElementById(id);
    if (!target) return;
    const max = target.scrollWidth - target.clientWidth;
    $$(`[data-scroll="${id}"]`).forEach((btn) => {
      const dir = Number(btn.dataset.dir) || 1;
      if (max <= 1) { btn.disabled = true; return; }
      btn.disabled = dir < 0 ? target.scrollLeft <= 1 : target.scrollLeft >= max - 1;
    });
  }

  function wireRailButtons() {
    $$('[data-scroll]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.scroll);
        if (!target) return;
        const dir = Number(btn.dataset.dir) || 1;
        const amount = Math.max(160, Math.round(target.clientWidth * 0.8));
        target.scrollBy({ left: dir * amount, behavior: 'smooth' });
      });
    });
    ['songTabs', 'stepPills', 'filmstrip', 'standWrap'].forEach((id) => {
      const target = document.getElementById(id);
      if (!target) return;
      let raf = 0;
      target.addEventListener('scroll', () => {
        if (raf) return;
        raf = requestAnimationFrame(() => { raf = 0; updateRail(id); });
      });
    });
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        ['songTabs', 'stepPills', 'filmstrip', 'standWrap'].forEach(updateRail);
      }, 120);
    });
  }

  /* ---------- mobile player: theater + gestures + sheet ---------- */
  const mqTheater = window.matchMedia('(orientation: landscape) and (max-height: 600px)');
  const mqMobile = window.matchMedia('(max-width: 900px)');
  let zoomScale = 1;
  let panX = 0;
  let panY = 0;
  let hideTimer = 0;
  let sheetOpen = false;
  let gestureSuppressUntil = 0;

  function inPlayerMode() {
    return document.body.classList.contains('player-mode');
  }

  function updatePlayerMode() {
    const full = isStageFull();
    const theater = state.view === 'stand' && !state.theaterOff && !full && mqTheater.matches;
    document.body.classList.toggle('theater', theater);
    const player = full || theater;
    document.body.classList.toggle('player-mode', player);
    if (player) {
      pokePlayer();
    } else {
      clearTimeout(hideTimer);
      document.body.classList.remove('controls-hidden');
    }
    applyZoom();
    syncFullBtn();
  }

  function pokePlayer() {
    if (!inPlayerMode()) return;
    document.body.classList.remove('controls-hidden');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (inPlayerMode() && !sheetOpen) document.body.classList.add('controls-hidden');
    }, 3000);
  }

  /* ---------- zoom ---------- */
  function applyZoom() {
    const el = $('#standZoom');
    if (!el) return;
    el.style.transform = (zoomScale === 1 && !panX && !panY)
      ? '' : `translate3d(${panX}px, ${panY}px, 0) scale(${zoomScale})`;
    const card = $('#stageCard');
    if (card) {
      card.classList.toggle('zoom-active', zoomScale > 1.01);
      card.classList.toggle('labels-off', !state.codesOn || zoomScale < 1.28);
    }
    const zoomBtn = $('#setZoom');
    if (zoomBtn) zoomBtn.textContent = zoomScale > 1.01 ? 'พอดีจอ' : 'ขยาย';
  }

  function resetZoom() {
    zoomScale = 1;
    panX = 0;
    panY = 0;
    applyZoom();
  }

  function toggleZoom(px, py) {
    const wrap = $('#standWrap');
    if (!wrap) return;
    if (zoomScale > 1.2) { resetZoom(); return; }
    const r = wrap.getBoundingClientRect();
    const ax = (px == null ? r.left + r.width / 2 : px) - (r.left + r.width / 2);
    const ay = (py == null ? r.top + r.height / 2 : py) - (r.top + r.height / 2);
    const s = 2.3;
    zoomScale = s;
    panX = ax * (1 - s);
    panY = ay * (1 - s);
    clampPan();
    applyZoom();
  }

  function clampPan() {
    const wrap = $('#standWrap');
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const mx = Math.max(0, (r.width * (zoomScale - 1)) / 2);
    const my = Math.max(0, (r.height * (zoomScale - 1)) / 2);
    panX = Math.max(-mx, Math.min(mx, panX));
    panY = Math.max(-my, Math.min(my, panY));
  }

  function jumpBy(n) {
    const target = curStep().gi + n;
    if (target < 0 || target >= flat.length) return;
    goGlobal(target);
    showToast(n > 0 ? `ข้ามไป ${n} เฟรม` : `ย้อนไป ${Math.abs(n)} เฟรม`);
  }

  function doubleTap(px, py) {
    const wrap = $('#standWrap');
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const rx = (px - r.left) / Math.max(1, r.width);
    if (inPlayerMode()) {
      if (rx < 0.28) { jumpBy(-10); return; }
      if (rx > 0.72) { jumpBy(10); return; }
    }
    toggleZoom(px, py);
  }

  function wireGestures() {
    const wrap = $('#standWrap');
    if (!wrap) return;
    const pointers = new Map();
    let mode = null;
    let startX = 0;
    let startY = 0;
    let startT = 0;
    let lastX = 0;
    let lastY = 0;
    let baseX = 0;
    let baseY = 0;
    let pinch = null;
    let moved = false;
    let lastTap = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    const avg = () => {
      let x = 0;
      let y = 0;
      pointers.forEach((p) => { x += p.x; y += p.y; });
      return { x: x / pointers.size, y: y / pointers.size };
    };
    const dist = () => {
      const pts = Array.from(pointers.values());
      if (pts.length < 2) return 0;
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };

    wrap.addEventListener('pointerdown', (e) => {
      if (!mqMobile.matches) return;
      if (e.target.closest('button, input')) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        mode = zoomScale > 1.01 ? 'pan' : 'swipe';
        startX = lastX = e.clientX;
        startY = lastY = e.clientY;
        startT = Date.now();
        baseX = panX;
        baseY = panY;
        moved = false;
        try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      } else if (pointers.size === 2) {
        mode = 'pinch';
        pinch = { d: dist() || 1, scale: zoomScale, mid: avg(), baseX: panX, baseY: panY };
        moved = true;
      }
      pokePlayer();
    });

    wrap.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (mode === 'pinch' && pointers.size >= 2 && pinch) {
        e.preventDefault();
        const scale = Math.max(1, Math.min(4, pinch.scale * (dist() / pinch.d)));
        const mid = avg();
        const r = wrap.getBoundingClientRect();
        const ax = mid.x - (r.left + r.width / 2);
        const ay = mid.y - (r.top + r.height / 2);
        const k = scale / pinch.scale;
        zoomScale = scale;
        panX = ax - k * (ax - pinch.baseX);
        panY = ay - k * (ay - pinch.baseY);
        clampPan();
        applyZoom();
        return;
      }
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (mode === 'pan') {
        panX += dx;
        panY += dy;
        clampPan();
        applyZoom();
      }
      if (Math.abs(e.clientX - startX) > 8 || Math.abs(e.clientY - startY) > 8) moved = true;
    });

    function end(e) {
      if (!pointers.has(e.pointerId)) return;
      const wasPinch = mode === 'pinch';
      pointers.delete(e.pointerId);
      if (pointers.size === 1) {
        const p = Array.from(pointers.values())[0];
        mode = zoomScale > 1.01 ? 'pan' : 'swipe';
        startX = lastX = p.x;
        startY = lastY = p.y;
        startT = Date.now();
        pinch = null;
        return;
      }
      if (pointers.size > 0) return;
      const dx = lastX - startX;
      const dy = lastY - startY;
      const dt = Date.now() - startT;
      pinch = null;
      if (wasPinch) {
        if (zoomScale < 1.06) resetZoom();
        mode = null;
        pokePlayer();
        return;
      }
      if (mode === 'swipe' && Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.25) {
        gestureSuppressUntil = Date.now() + 450;
        if (dx < 0) next();
        else prev();
      } else if (!moved && dt < 320) {
        const now = Date.now();
        if (now - lastTap < 330 && Math.hypot(lastX - lastTapX, lastY - lastTapY) < 44) {
          doubleTap(lastX, lastY);
          lastTap = 0;
        } else {
          lastTap = now;
          lastTapX = lastX;
          lastTapY = lastY;
        }
      }
      mode = null;
      pokePlayer();
    }
    wrap.addEventListener('pointerup', end);
    wrap.addEventListener('pointercancel', end);
  }

  /* ---------- timeline scrub (theater) ---------- */
  function goFast(gi) {
    const n = flat.length;
    const st = flat[((gi % n) + n) % n];
    state.si = st.si;
    state.step = st.i;
    paintStage();
    renderPlayerChrome();
    renderLyric();
    renderMyCard();
  }

  function wireScrubber() {
    const track = $('#thTrack');
    if (!track) return;
    let dragging = false;
    let pending = 0;
    const frameAt = (clientX) => {
      const r = track.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width)));
      return Math.round(t * (flat.length - 1));
    };
    const preview = (clientX) => goFast(frameAt(clientX));
    track.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dragging = true;
      pokePlayer();
      try { track.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      preview(e.clientX);
    });
    track.addEventListener('pointermove', (e) => {
      if (!dragging || pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        if (dragging) preview(e.clientX);
      });
    });
    const stop = () => {
      if (!dragging) return;
      dragging = false;
      renderStandAll();
      updateHash();
    };
    track.addEventListener('pointerup', stop);
    track.addEventListener('pointercancel', stop);
    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      pokePlayer();
    });
  }

  function cycleSpeed() {
    state.speedIdx = (state.speedIdx + 1) % SPEEDS.length;
    const btn = $('#btnSpeed');
    if (btn) btn.textContent = SPEEDS[state.speedIdx].label;
    const th = $('#thSpeed');
    if (th) th.textContent = SPEEDS[state.speedIdx].label;
    const set = $('#setSpeed');
    if (set) set.textContent = SPEEDS[state.speedIdx].label;
    if (state.autoplay) startAuto();
    else renderMyCard();
    showToast('ความเร็วเล่นอัตโนมัติ <b>' + SPEEDS[state.speedIdx].label + '</b>');
  }

  /* ---------- settings sheet ---------- */
  function syncSheet() {
    const codes = $('#setCodes');
    if (codes) {
      codes.setAttribute('aria-pressed', String(state.codesOn));
      codes.textContent = state.codesOn ? 'แสดงเมื่อซูม' : 'ซ่อน';
    }
    const focus = $('#setFocus');
    if (focus) {
      focus.setAttribute('aria-pressed', String(state.focusSeat));
      focus.textContent = state.focusSeat ? 'เปิด' : 'ปิด';
    }
    const th = $('#setTheater');
    if (th) {
      th.setAttribute('aria-pressed', String(!state.theaterOff));
      th.textContent = state.theaterOff ? 'ปิด' : 'เปิด';
    }
    const set = $('#setSpeed');
    if (set) set.textContent = SPEEDS[state.speedIdx].label;
    const zoom = $('#setZoom');
    if (zoom) zoom.textContent = zoomScale > 1.01 ? 'พอดีจอ' : 'ขยาย';
  }

  function openSheet() {
    sheetOpen = true;
    $('#settingsSheet').hidden = false;
    $('#sheetBackdrop').hidden = false;
    document.body.classList.add('sheet-open');
    document.body.classList.remove('controls-hidden');
    clearTimeout(hideTimer);
    syncSheet();
  }

  function closeSheet() {
    sheetOpen = false;
    $('#settingsSheet').hidden = true;
    $('#sheetBackdrop').hidden = true;
    document.body.classList.remove('sheet-open');
    pokePlayer();
  }

  function wirePlayerUI() {
    const on = (sel, fn) => {
      const el = $(sel);
      if (el) el.addEventListener('click', fn);
    };
    on('#btnSettings', openSheet);
    on('#thSettings', openSheet);
    on('#sheetClose', closeSheet);
    on('#sheetBackdrop', closeSheet);

    on('#setCodes', () => {
      state.codesOn = !state.codesOn;
      $('#stageCard').classList.toggle('codes-off', !state.codesOn);
      $('#btnCodes').classList.toggle('active', state.codesOn);
      applyZoom();
      syncSheet();
    });
    on('#setFocus', () => { setSeatFocus(!state.focusSeat); syncSheet(); });
    on('#setTheater', () => {
      state.theaterOff = !state.theaterOff;
      if (state.theaterOff && isStageFull()) exitStageFullscreen();
      updatePlayerMode();
      syncSheet();
    });
    on('#setSpeed', cycleSpeed);
    on('#setZoom', () => {
      if (zoomScale > 1.01) resetZoom();
      else toggleZoom();
      syncSheet();
    });
    on('#setFull', () => { closeSheet(); toggleFull(); });
    on('#setClearSeat', () => { clearSeat(); syncSheet(); });

    const setSearch = $('#setSearchForm');
    if (setSearch) {
      setSearch.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = $('#setSearch').value;
        closeSheet();
        handleQuickSearch(v);
        $('#setSearch').value = '';
      });
    }

    const myForm = $('#myForm');
    if (myForm) {
      myForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const seat = normalizeSeat($('#myInput').value);
        if (seat) {
          selectSeat(seat, { force: true });
          showToast('ที่นั่งของคุณคือ <b>' + seat + '</b>');
          $('#myInput').blur();
        } else {
          showToast('รหัสที่นั่งไม่ถูกต้อง — ใช้ A1 ถึง O10');
        }
      });
    }

    on('#mhPlay', toggleAuto);
    on('#thPlay', toggleAuto);
    on('#thCenterPlay', toggleAuto);
    on('#mhExpand', toggleFull);
    on('#thPrev', prev);
    on('#thNext', next);
    on('#thSpeed', cycleSpeed);
    on('#thExit', () => {
      if (isStageFull()) exitStageFullscreen();
      else {
        state.theaterOff = true;
        updatePlayerMode();
        syncSheet();
      }
    });

    document.addEventListener('pointerdown', pokePlayer, true);

    mqTheater.addEventListener('change', updatePlayerMode);
    mqMobile.addEventListener('change', updatePlayerMode);
    window.addEventListener('orientationchange', () => setTimeout(updatePlayerMode, 120));
  }

  /* ---------- events ---------- */
  function bindEvents() {
    $('.app-shell').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-view]');
      if (!btn) return;
      e.preventDefault();
      setView(btn.dataset.view);
    });

    $('#songTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.song-tab');
      if (!btn) return;
      const si = Number(btn.dataset.song);
      const song = songs[si];
      state.si = si;
      state.step = 0;
      setView('stand');
      showToast('เปิดหน้า <b>' + esc(song.title) + '</b>');
    });

    $('#btnPrev').addEventListener('click', prev);
    $('#btnNext').addEventListener('click', next);
    $('#btnPrevFs').addEventListener('click', prev);
    $('#btnNextFs').addEventListener('click', next);
    $('#btnPlay').addEventListener('click', toggleAuto);
    $('#btnSpeed').addEventListener('click', cycleSpeed);
    $('#scrub').addEventListener('input', (e) => {
      const v = Number(e.target.value);
      setRange(e.target);
      goGlobal(v - 1);
    });

    $('#stepPills').addEventListener('click', (e) => {
      const btn = e.target.closest('.step-pill');
      if (!btn) return;
      state.step = Number(btn.dataset.i);
      renderStandAll();
      updateHash();
    });

    $('#filmstrip').addEventListener('click', (e) => {
      const btn = e.target.closest('.film-item');
      if (!btn) return;
      state.step = Number(btn.dataset.i);
      renderStandAll();
      updateHash();
    });

    $('#standGrid').addEventListener('click', (e) => {
      if (Date.now() < gestureSuppressUntil) return;
      const cell = e.target.closest('.seat-cell');
      if (!cell) return;
      selectSeat(cell.dataset.seat);
      if (state.seat) {
        const hex = curStep().colors[seatIndex()];
        showToast(`<b>${state.seat}</b> · ${esc(A.colors[hex].short)}`);
      }
      pokePlayer();
    });

    $('#colorSummary').addEventListener('click', (e) => {
      const chip = e.target.closest('.color-chip');
      if (chip) { setColorFocus(chip.dataset.color); return; }
      if (e.target.closest('#colorClear')) {
        state.colorFocus = null;
        paintStage();
        renderColorSummary();
        updateFocusBanner();
      }
    });

    $('#btnCodes').addEventListener('click', () => {
      const card = $('#stageCard');
      card.classList.toggle('codes-off');
      state.codesOn = !card.classList.contains('codes-off');
      $('#btnCodes').classList.toggle('active', state.codesOn);
      applyZoom();
      syncSheet();
    });
    $('#btnFocus').addEventListener('click', () => setSeatFocus(!state.focusSeat));
    $('#btnFocus2').addEventListener('click', () => setSeatFocus(!state.focusSeat));
    $('#btnFull').addEventListener('click', toggleFull);
    $('#btnZoom').addEventListener('click', () => setZoom(!state.standZoom));
    $('#inspClear').addEventListener('click', clearSeat);
    $('#focusBannerClear').addEventListener('click', () => {
      state.colorFocus = null;
      setSeatFocus(false);
      renderColorSummary();
    });

    $('#tlSeg').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-scope]');
      if (!btn) return;
      state.tlScope = btn.dataset.scope;
      $$('#tlSeg button').forEach((b) => b.classList.toggle('active', b === btn));
      renderTimeline();
    });
    $('#tlList').addEventListener('click', (e) => {
      const row = e.target.closest('.tl-row');
      if (!row) return;
      goGlobal(Number(row.dataset.gi));
    });

    $('#seatGo').addEventListener('click', () => {
      const seat = normalizeSeat($('#seatInput').value);
      if (seat) { selectSeat(seat, { force: true }); showToast('เลือกที่นั่ง <b>' + seat + '</b>'); }
      else showToast('รหัสที่นั่งไม่ถูกต้อง — ใช้ A1 ถึง O10');
    });
    $('#seatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); $('#seatGo').click(); }
    });

    $('#searchForm').addEventListener('submit', (e) => {
      e.preventDefault();
      handleQuickSearch($('#quickSeat').value);
    });

    $('#btnCopy').addEventListener('click', copyCueSheet);

    /* gallery */
    $('#gSong').addEventListener('change', (e) => {
      state.gSong = e.target.value;
      renderGallery();
    });
    let gTimer = null;
    $('#gSearch').addEventListener('input', (e) => {
      clearTimeout(gTimer);
      gTimer = setTimeout(() => {
        state.gSearch = e.target.value;
        renderGallery();
      }, 150);
    });
    $('#gColored').addEventListener('change', (e) => {
      state.gColored = e.target.checked;
      renderGallery();
    });
    $('#gUnique').addEventListener('change', (e) => {
      state.gUnique = e.target.checked;
      renderGallery();
    });
    $('#galleryContainer').addEventListener('click', (e) => {
      const span = e.target.closest('.mini span');
      if (span) {
        const mini = span.parentElement;
        const k = Array.prototype.indexOf.call(mini.children, span);
        if (k >= 0 && SEATS[k]) {
          selectSeat(SEATS[k]);
          showToast('เลือกที่นั่ง <b>' + SEATS[k] + '</b>');
        }
        return;
      }
      const card = e.target.closest('.gcard');
      if (card) goGlobal(Number(card.dataset.gi));
    });

    /* songbook + analysis program links */
    $('#view-songbook').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-page]');
      if (btn) openPage(Number(btn.dataset.page), Number(btn.dataset.step || 0));
    });

    $('#analysisContainer').addEventListener('click', (e) => {
      const step = e.target.closest('.astep');
      if (step) { goGlobal(Number(step.dataset.gi)); return; }
      const heat = e.target.closest('.heat-cell');
      if (heat) {
        selectSeat(heat.dataset.seat);
        renderTimeline();
        return;
      }
      const cd = e.target.closest('.cd-card');
      if (cd) {
        state.colorFocus = cd.dataset.color;
        setView('stand');
        showToast('โฟกัสสี <b>' + esc(A.colors[cd.dataset.color].short) + '</b>');
        return;
      }
      const prog = e.target.closest('[data-page]');
      if (prog) openPage(Number(prog.dataset.page), Number(prog.dataset.step || 0));
    });
    $('#analysisContainer').addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('astep')) {
        e.preventDefault();
        goGlobal(Number(e.target.dataset.gi));
      }
    });

    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      else if (e.key === ' ') { e.preventDefault(); toggleAuto(); }
      else if (e.key === '1') setView('stand');
      else if (e.key === '2') setView('songbook');
      else if (e.key === '3') setView('gallery');
      else if (e.key === '4') setView('analysis');
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFull(); }
      else if (e.key === 'Escape') {
        if ($('#stageCard').classList.contains('expanded')) exitStageFullscreen();
      }
    });

    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) state.fsSession = false;
      syncFullBtn();
      updatePlayerMode();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state.autoplay) stopAuto();
    });
  }

  /* ---------- init ---------- */
  /* ---------- anti-capture: ลายน้ำ "ห้ามแคป" + เตือน ---------- */
  function buildNoCapMarks() {
    const w = Math.round(Math.max(window.innerWidth, 320) * 1.6);
    const h = Math.round(Math.max(window.innerHeight, 320) * 1.6);
    ['#noCapMark', '#noCapStage'].forEach((sel) => {
      const host = $(sel);
      if (!host) return;
      const parts = [];
      for (let y = 0, row = 0; y < h; y += 84, row += 1) {
        for (let x = (row % 2) * 96; x < w; x += 192) {
          parts.push(`<span style="left:${x}px;top:${y}px">ห้ามแคป</span>`);
        }
      }
      host.innerHTML = parts.join('');
    });
  }

  let capFlash = null;
  function flashCaptureGuard() {
    document.body.classList.add('capture-guard');
    clearTimeout(capFlash);
    capFlash = setTimeout(() => {
      if (!document.hidden && document.hasFocus()) document.body.classList.remove('capture-guard');
    }, 2000);
  }

  function wireNoCapture() {
    buildNoCapMarks();
    let rz = null;
    window.addEventListener('resize', () => {
      clearTimeout(rz);
      rz = setTimeout(buildNoCapMarks, 300);
    });

    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showToast('ไม่อนุญาตให้แคปหรือบันทึกภาพ');
    });
    document.addEventListener('dragstart', (e) => e.preventDefault());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        flashCaptureGuard();
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.altKey && /^(p|s)$/i.test(e.key)) {
        e.preventDefault();
        flashCaptureGuard();
      }
    });

    // สลับแท็บ/แอป → เบลอทั้งหน้าและขึ้นป้าย "ไม่อนุญาตให้แคป"
    document.addEventListener('visibilitychange', () => {
      document.body.classList.toggle('capture-guard', document.hidden);
    });
    window.addEventListener('blur', () => { if (!document.hidden) flashCaptureGuard(); });
    window.addEventListener('focus', () => {
      clearTimeout(capFlash);
      document.body.classList.remove('capture-guard');
    });

    // fullscreen วาดเฉพาะลูกของ stageCard → ย้ายป้ายเตือนเข้าไปตอนเต็มจอ
    document.addEventListener('fullscreenchange', () => {
      const guard = $('#capGuard');
      if (!guard) return;
      if (document.fullscreenElement) document.fullscreenElement.appendChild(guard);
      else document.body.appendChild(guard);
    });
  }

  function init() {
    readHash();
    buildStandGrid();
    $('#gSong').innerHTML = '<option value="all">ทุกหน้า (10)</option>'
      + songs.map((s) => `<option value="${s.si}">${s.id}. ${esc(s.title)}</option>`).join('');
    $('#chipSteps').textContent = String(flat.length);
    bindEvents();
    wireRailButtons();
    wireGestures();
    wireScrubber();
    wirePlayerUI();
    wireNoCapture();
    setView(state.view);
    syncFullBtn();
    updatePlayerMode();
    applyZoom();
    setInterval(() => {
      if (!state.autoplay || !state.seat) return;
      const idx = seatIndex();
      if (idx < 0) return;
      const next = seatNextInfo(idx);
      if (next) updateMyEta(next);
    }, 250);
    requestAnimationFrame(() => {
      ['songTabs', 'stepPills', 'filmstrip', 'standWrap'].forEach(updateRail);
    });
  }

  init();
})();
