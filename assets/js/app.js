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
    metro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.3 6a8.5 8.5 0 0 1 0 12"/></svg>',
    metroOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M16 9l5 6M21 9l-5 6"/></svg>',
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

  /* ---------- timing ----------
     แต่ละเฟรมมีระยะเวลา = beats × 60000 / bpm ของเพลง
     ค่า beats/bpm มาจาก tools/data/*.csv ผ่าน tools/build_data.py
     ถ้าโหลด bundle เก่าที่ไม่มีฟิลด์นี้ จะ fallback เป็น 100 BPM / 16 บีต */
  const DEFAULT_BPM = 180;
  const DEFAULT_BEATS = 16;
  let showMs = 0;
  songs.forEach((song) => {
    song.bpm = Number(song.bpm) > 0 ? Number(song.bpm) : DEFAULT_BPM;
    const songStart = showMs;
    let songMs = 0;
    let beatsInSong = 0;
    song.steps.forEach((st) => {
      st.beats = Number(st.beats) > 0 ? Number(st.beats) : DEFAULT_BEATS;
      st.beatStart = beatsInSong;
      beatsInSong += st.beats;
      st.durMs = Math.max(1, st.beats * 60000 / song.bpm);
      st.startMs = songStart + songMs;
      songMs += st.durMs;
    });
    song.startMs = songStart;
    song.durMs = songMs;
    showMs += songMs;
  });
  const SHOW_MS = Math.max(1, showMs);

  /* บีตตำแหน่งรวมทั้งงาน (ใช้เป็นนาฬิกาเดียวของภาพ+เสียง)
     ทุกเฟรมเริ่มที่บีตจำนวนเต็ม → เปลี่ยนโค้ดตรงจังหวะที่ 1 ของห้องได้จริง */
  let showBeat = 0;
  flat.forEach((st) => {
    st.showBeatStart = showBeat;
    showBeat += st.beats;
  });
  const SHOW_BEATS = showBeat;

  function frameAtMs(ms) {
    const t = Math.max(0, Math.min(SHOW_MS, ms));
    let lo = 0;
    let hi = flat.length - 1;
    let ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (flat[mid].startMs <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  }

  function fmtMs(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function fmtSec(ms) {
    const s = Math.max(0, ms / 1000);
    return s < 10 ? s.toFixed(1) : String(Math.round(s));
  }

  /* ---------- global analytics ---------- */
  const colorUsage = new Map(PALETTE.map((h) => [h, { cells: 0, frames: 0, songs: new Set() }]));
  const seatStats = SEATS.map(() => ({ colored: 0, counts: new Map(), transitions: 0 }));
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

  /* จำนวนครั้งที่สีของแต่ละที่นั่งเปลี่ยน (นับข้ามเพลงด้วย) +
     สถิติเพลทแบบแยกขาว/ขึ้นมือออกจากกัน */
  for (let i = 1; i < flat.length; i += 1) {
    const prevColors = flat[i - 1].colors;
    const nextColors = flat[i].colors;
    for (let k = 0; k < 150; k += 1) {
      if (prevColors[k] !== nextColors[k]) seatStats[k].transitions += 1;
    }
  }
  seatStats.forEach((s) => {
    s.handFrames = flat.length - s.colored;
    s.plateCounts = new Map();
    s.counts.forEach((n, h) => { if (h !== '#ffffff') s.plateCounts.set(h, n); });
    s.plateDistinct = s.plateCounts.size;
    let best = null;
    s.plateCounts.forEach((n, h) => { if (!best || n > best.n) best = { hex: h, n }; });
    s.topPlate = best;
  });

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
  function studentOf(seat) {
    return window.GSStudents ? window.GSStudents.get(seat) : null;
  }
  function seatWho(seat) {
    const stu = studentOf(seat);
    return stu ? `น้อง${stu.nickname} (${stu.grade})` : '';
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
  const state = {
    view: 'stand',
    si: 0,
    step: 0,
    seat: null,
    autoplay: false,
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
    nicksOn: false,
    nextAdvanceAt: 0,
    dragMs: null,
    desktopScrubActive: false,
  };

  const seatIndex = () => (state.seat ? SEAT_INDEX.get(state.seat) : -1);
  let fullAttempt = 0;

  /* ค่าเริ่มต้นเมื่อเปิดหน้าโดยไม่มี hash ระบุตำแหน่ง: เฟรมถ้วยรางวัล + เลข 1
     (รหัส 4.7 = เฟรม 64 ในลำดับแสดง) ให้หน้าแรกที่เปิดเห็นภาพความสำเร็จก่อน
     — ลิงก์ที่ระบุ song/step ยังทำงานตามปกติ */
  const DEFAULT_STEP_CODE = '4.7';

  function applyDefaultStep() {
    const target = flat.find((x) => x.code === DEFAULT_STEP_CODE);
    if (!target) return;
    state.si = target.si;
    state.step = target.i;
  }

  function readHash() {
    const raw = location.hash.replace(/^#/, '');
    if (!raw) return false;
    let p;
    try { p = new URLSearchParams(raw); } catch (e) { return false; }
    let hasPos = false;
    const v = p.get('view');
    if (['stand', 'songbook', 'gallery', 'analysis', 'badge'].includes(v)) state.view = v;
    const s = parseInt(p.get('song'), 10);
    if (s >= 1 && s <= songs.length) { state.si = s - 1; hasPos = true; }
    const st = parseInt(p.get('step'), 10);
    const max = songs[state.si].steps.length;
    if (st >= 1 && st <= max) { state.step = st - 1; hasPos = true; }
    state.seat = normalizeSeat(p.get('seat'));
    return hasPos;
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

  /* ---------- tempo ----------
     ค่าเริ่มต้นคือ bpm ของเพลง (จาก songs.csv)
     ผู้ใช้ปรับ BPM เฉพาะเพลงนี้ได้ โดยไม่แก้ข้อมูลต้นฉบับ            */
  const BPM_MIN = 40;
  const BPM_MAX = 240;
  function songBpm(song) {
    const n = Number(song.playBpm);
    return n >= BPM_MIN && n <= BPM_MAX ? n : song.bpm;
  }

  function framePlayMs(st) {
    const song = curSong();
    return Math.max(1, st.durMs * (song.bpm / songBpm(song)));
  }

  function elapsedInFrame() {
    if (!state.autoplay) return 0;
    const st = curStep();
    const song = curSong();
    /* ตำแหน่งบีตจากนาฬิกาเดียว → แปลงเป็นเวลาแบบโน้ตเพลง (bpm ต้นฉบับ) */
    const beatsIn = Math.max(0, Math.min(st.beats, playPosBeat() - st.showBeatStart));
    return beatsIn * (60000 / song.bpm);
  }

  function timelineMs() {
    if (state.dragMs != null) {
      return Math.max(0, Math.min(SHOW_MS, state.dragMs));
    }
    return Math.min(SHOW_MS, curStep().startMs + elapsedInFrame());
  }

  function syncScrubTime() {
    const el = $('#scrub');
    if (!el || state.desktopScrubActive) return;
    el.value = String(Math.round(timelineMs()));
    setRange(el);
  }

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
  const APP_TITLE = 'คณะสีเขียว พิริยาลัย · Triple Crown';
  const VIEW_META = {
    stand: { title: 'แสตนเชียร์', sub: `15 × 10 · ${flat.length} เฟรม` },
    songbook: { title: 'ใบเพลง', sub: `${songs.length} เพลง · ${A.songbook.length} ช่วง · ${flat.length} เฟรม` },
    gallery: { title: 'แกลเลอรี', sub: `ทุกเฟรม · ${flat.length}` },
    analysis: { title: 'วิเคราะห์', sub: `ภาพรวมทั้งงาน · ${songs.length} เพลง` },
    badge: { title: 'ป้ายประจำตัว', sub: 'การ์ด IG Story + ป้ายชื่อ · ดาวน์โหลดเก็บไว้ได้' },
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
    ['stand', 'songbook', 'gallery', 'analysis', 'badge'].forEach((x) => {
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
    else if (state.view === 'badge') {
      if (window.GSBadge) window.GSBadge.renderView(state.seat);
    } else renderAnalysis();
  }

  function openPage(pageId, stepIndex = 0) {
    const si = songs.findIndex((s) => s.id === pageId);
    if (si < 0) return;
    state.si = si;
    state.step = Math.max(0, Math.min(stepIndex, songs[si].steps.length - 1));
    setView('stand');
  }

  function applyFrame(gi) {
    const n = flat.length;
    const st = flat[((gi % n) + n) % n];
    state.si = st.si;
    state.step = st.i;
    if (state.view === 'stand') { renderStandAll(); updateHash(); }
    else if (state.view === 'badge') {
      if (window.GSBadge) window.GSBadge.renderView(state.seat);
      updateHash();
    } else setView('stand');
    return st;
  }

  function goGlobal(gi, anchor = true) {
    applyFrame(gi);
    if (state.autoplay && !state.desktopScrubActive) scheduleNext(anchor);
  }

  function next(opts) { goGlobal(curStep().gi + 1, !(opts && opts.anchor === false)); }
  function prev(opts) { goGlobal(curStep().gi - 1, !(opts && opts.anchor === false)); }

  /* ---------- autoplay + metronome: นาฬิกาเดียว (บีต) ----------
     ภาพและเสียงอ่านจากตำแหน่งบีตเดียวกัน
     · เฟรมเปลี่ยนเมื่อตำแหน่งบีตข้าม showBeatStart ของเฟรมถัดไป
     · ตัวเคาะ schedule ล่วงหน้าบน AudioContext.currentTime
     → เปลี่ยนโค้ดตรงจังหวะที่ 1 และไม่หลุดกันแม้ข้ามเฟรม/เพลง */
  const METRO_KEY = 'greencheer.metroMuted';
  let metroMuted = false; /* ค่าเริ่มต้น: เปิดเสียง */
  let audioCtx = null;
  let metroNodes = [];
  let metroNextBeat = 0;
  let metroNextTime = 0;
  try {
    const stored = localStorage.getItem(METRO_KEY);
    if (stored !== null) metroMuted = stored === '1';
  } catch (err) {
    metroMuted = false;
  }

  /* เนื้อเพลงลอยบนแสตน (มือถือ) — ค่าเริ่มต้นปิด: เห็นแค่หน้าแสตน */
  const LYRICS_KEY = 'greencheer.showLyrics';
  let showLyrics = false;
  try {
    showLyrics = localStorage.getItem(LYRICS_KEY) === '1';
  } catch (err) {
    showLyrics = false;
  }

  let playTimer = null;
  const playClock = { beatMs: 500, anchorBeat: 0, anchorTime: 0, audio: false };
  const CLOCK_LOOKAHEAD = 0.25; /* วินาที */

  function ensureAudio() {
    if (!audioCtx) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      audioCtx = new AudioCtor();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function clockNow() {
    return playClock.audio && audioCtx ? audioCtx.currentTime : performance.now() / 1000;
  }

  function killMetroNode(entry) {
    try { entry.osc.stop(); } catch (err) { /* already stopped */ }
    const i = metroNodes.indexOf(entry);
    if (i >= 0) metroNodes.splice(i, 1);
  }

  function stopMetronome() {
    metroNodes.forEach((entry) => { try { entry.osc.stop(); } catch (err) { /* already stopped */ } });
    metroNodes = [];
  }

  /* ตอนเปลี่ยน BPM กลางทาง: เก็บเสียงที่เคาะค้างไว้ถึงบีตเส้นแบ่งไว้
     แล้วเคาะต่อจากบีตถัดไปด้วย tempo ใหม่ → รอยต่อเพลงไม่มีช่องเงียบ */
  function stopMetronomeAfter(beat) {
    metroNodes.slice().forEach((entry) => {
      if (entry.beat > beat + 1e-6) killMetroNode(entry);
    });
  }

  /* เมโทรนอมจังหวะปกติ: เน้นบีต 1 ของห้อง (1245 Hz) บีตอื่น 1000 Hz */
  function metroClick(at, beat) {
    if (!audioCtx) return;
    const bar = Math.round(beat) % 4 === 0;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(bar ? 1245 : 1000, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(bar ? 0.2 : 0.12, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(at);
    osc.stop(at + 0.1);
    const entry = { osc, beat };
    metroNodes.push(entry);
    osc.onended = () => {
      const i = metroNodes.indexOf(entry);
      if (i >= 0) metroNodes.splice(i, 1);
    };
  }

  function playPosBeat() {
    if (!state.autoplay) return playClock.anchorBeat;
    const dt = Math.max(0, clockNow() - playClock.anchorTime);
    return playClock.anchorBeat + dt * 1000 / playClock.beatMs;
  }

  /* ตั้งจุดอ้างอิงของนาฬิกา: ตำแหน่งบีต `beat` จะเริ่มที่เวลานี้ (อีก 50ms) */
  function anchorClock(beat) {
    const ctx = ensureAudio();
    playClock.audio = !!ctx;
    playClock.beatMs = 60000 / songBpm(curSong());
    playClock.anchorBeat = beat;
    playClock.anchorTime = clockNow() + 0.05;
    stopMetronome();
    metroNextBeat = Math.ceil(beat - 1e-6);
    metroNextTime = playClock.anchorTime + (metroNextBeat - beat) * playClock.beatMs / 1000;
    const st = curStep();
    state.nextAdvanceAt = Date.now() + Math.max(0, st.showBeatStart + st.beats - beat) * playClock.beatMs;
  }

  /* เมโทรนอมเคาะทุกบีต (จังหวะเพลง) — เน้นบีต 1 ของห้อง */
  function metroPump() {
    if (metroMuted || !audioCtx) return;
    const horizon = audioCtx.currentTime + CLOCK_LOOKAHEAD;
    const stepSec = playClock.beatMs / 1000;
    while (metroNextTime < horizon) {
      metroClick(metroNextTime, metroNextBeat);
      metroNextBeat += 1;
      metroNextTime += stepSec;
    }
  }

  /* pump เดียวจบ: เลื่อนเฟรมตามบีต + อัปเดต ETA + เคาะเมโทรนอม */
  function playPump() {
    if (!state.autoplay) { stopPlaybackClock(); return; }
    const pos = playPosBeat();
    let st = curStep();
    while (pos >= st.showBeatStart + st.beats - 1e-6 && st.gi < flat.length - 1) {
      const boundary = st.showBeatStart + st.beats;
      const oldBeatMs = playClock.beatMs;
      const nextSt = applyFrame(st.gi + 1);
      const nextBeatMs = 60000 / songBpm(songs[nextSt.si]);
      if (Math.abs(nextBeatMs - oldBeatMs) > 0.01) {
        /* ข้ามเพลงที่ BPM ต่างกัน — รีแองเคอร์ที่เส้นแบ่งโดยคงตำแหน่งบีต */
        const now = clockNow();
        playClock.anchorBeat = boundary;
        playClock.beatMs = nextBeatMs;
        playClock.anchorTime = now - (pos - boundary) * oldBeatMs / 1000;
        stopMetronomeAfter(boundary);
        metroNextBeat = boundary + 1;
        metroNextTime = playClock.anchorTime + nextBeatMs / 1000;
      }
      st = curStep();
    }
    if (st.gi >= flat.length - 1 && pos >= st.showBeatStart + st.beats - 1e-6) {
      stopAuto();
      showToast('จบการแสดงแล้ว · ' + fmtMs(SHOW_MS));
      return;
    }
    state.nextAdvanceAt = Date.now()
      + Math.max(0, st.showBeatStart + st.beats - pos) * playClock.beatMs;
    metroPump();
  }

  function ensurePlayClock() {
    if (playTimer) return;
    playTimer = setInterval(playPump, 20);
    playPump();
  }

  function stopPlaybackClock() {
    if (playTimer) clearInterval(playTimer);
    playTimer = null;
    state.nextAdvanceAt = 0;
    stopMetronome();
  }

  function scheduleNext(anchor = true) {
    if (!state.autoplay) { stopPlaybackClock(); return; }
    if (anchor || !playTimer) anchorClock(curStep().showBeatStart);
    ensurePlayClock();
  }

  function updateMetroBtn() {
    const icon = metroMuted ? ICONS.metroOff : ICONS.metro;
    const label = metroMuted ? 'เปิดเสียงเมโทรนอม' : 'ปิดเสียงเมโทรนอม';
    ['#btnMetro', '#thMetro', '#mhMetro'].forEach((sel) => {
      const btn = $(sel);
      if (!btn) return;
      btn.innerHTML = icon;
      btn.setAttribute('aria-label', label);
      btn.setAttribute('aria-pressed', String(!metroMuted));
      btn.classList.toggle('is-muted', metroMuted);
    });
    const set = $('#setMetro');
    if (set) {
      set.textContent = metroMuted ? 'ปิด' : 'เปิด';
      set.setAttribute('aria-pressed', String(!metroMuted));
    }
  }

  function toggleMetro() {
    metroMuted = !metroMuted;
    try { localStorage.setItem(METRO_KEY, metroMuted ? '1' : '0'); } catch (err) { /* ignore */ }
    updateMetroBtn();
    if (metroMuted) {
      stopMetronome();
    } else if (state.autoplay && playTimer) {
      /* เปิดเสียงกลางทาง: เริ่มเคาะจากบีตถัดไปของนาฬิกาเดิม ไม่รีสตาร์ตภาพ */
      const pos = playPosBeat();
      const beatSec = playClock.beatMs / 1000;
      metroNextBeat = Math.ceil(pos - 1e-6);
      metroNextTime = clockNow() + Math.max(0.02, (metroNextBeat - pos) * beatSec);
      metroPump();
    }
    showToast(metroMuted ? 'ปิดเสียงเมโทรนอม' : 'เปิดเสียงเมโทรนอม');
  }

  function updateLyricBtn() {
    const label = showLyrics ? 'ซ่อนเนื้อเพลง' : 'แสดงเนื้อเพลงบนแสตน';
    ['#mhLyric', '#thLyric'].forEach((sel) => {
      const btn = $(sel);
      if (!btn) return;
      btn.setAttribute('aria-label', label);
      btn.setAttribute('aria-pressed', String(showLyrics));
      btn.classList.toggle('is-muted', !showLyrics);
    });
  }

  function toggleLyrics() {
    showLyrics = !showLyrics;
    try { localStorage.setItem(LYRICS_KEY, showLyrics ? '1' : '0'); } catch (err) { /* ignore */ }
    updateLyricBtn();
    renderLyric();
    showToast(showLyrics ? 'แสดงเนื้อเพลงบนแสตน' : 'ซ่อนเนื้อเพลง — เห็นแค่แสตน');
  }

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
    stopPlaybackClock();
    state.dragMs = null;
    updatePlayBtn();
    renderMyCard();
  }

  function startAuto() {
    stopAuto();
    if (curStep().gi >= flat.length - 1) goGlobal(0, false);
    state.autoplay = true;
    anchorClock(curStep().showBeatStart);
    ensurePlayClock();
    updatePlayBtn();
    renderMyCard();
    renderPlayerChrome();
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
          <span class="st-sub">CODE ${esc(s.showCode)} · ${s.steps.length} เฟรม · ${fmtMs(s.durMs)}</span>
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
        const stu = studentOf(seat);
        html += `<div class="seat-cell p0" data-seat="${seat}" role="gridcell" aria-label="ที่นั่ง ${seat}"><span class="slabel">${seat}</span><span class="nlabel">${stu ? esc(stu.nickname) : ''}</span></div>`;
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

  /* tooltip ชื่อเจ้าของที่นั่ง (desktop hover) */
  let seatTipEl = null;
  function showSeatTip(cell) {
    if (!seatTipEl) seatTipEl = $('#seatTip');
    const seat = cell && cell.dataset ? cell.dataset.seat : null;
    if (!seatTipEl || !seat) return;
    const stu = studentOf(seat);
    const who = stu
      ? ` · <b>น้อง${esc(stu.nickname)}</b> <span>(${esc(stu.grade)})</span>`
      : '';
    seatTipEl.innerHTML = `<b>${seat}</b>${who}`;
    const r = cell.getBoundingClientRect();
    seatTipEl.style.left = (r.left + r.width / 2) + 'px';
    seatTipEl.style.top = r.top + 'px';
    seatTipEl.hidden = false;
  }
  function hideSeatTip() {
    if (!seatTipEl) seatTipEl = $('#seatTip');
    if (seatTipEl) seatTipEl.hidden = true;
  }
  function wireSeatTips() {
    const grid = $('#standGrid');
    if (!grid) return;
    grid.addEventListener('pointerover', (e) => {
      const cell = e.target.closest('.seat-cell');
      if (cell) showSeatTip(cell);
    });
    grid.addEventListener('pointerout', (e) => {
      const cell = e.target.closest('.seat-cell');
      if (cell) hideSeatTip();
    });
    const standWrap = $('#standWrap');
    if (standWrap) standWrap.addEventListener('scroll', hideSeatTip, { passive: true });
    const main = $('#appMain');
    if (main) main.addEventListener('scroll', hideSeatTip, { passive: true });
    window.addEventListener('resize', hideSeatTip);
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
      const who = seatWho(SEATS[k]);
      const label = `ที่นั่ง ${SEATS[k]}` + (who ? ` · ${who}` : '');
      el.setAttribute('aria-label', `${label} · สี${meta.short}`);
      el.title = `${label} · ${meta.name}`;
    }
  }

  function renderPlayer() {
    const song = curSong();
    const st = curStep();
    const card = $('#playerCard');
    card.style.setProperty('--sa', song.theme[0]);
    card.style.setProperty('--sb', song.theme[1]);
    $('#playerKicker').textContent = `SONG ${String(song.id).padStart(2, '0')} · ${codeLabel(song)} · ${Math.round(songBpm(song))} BPM`;
    $('#playerTitle').textContent = song.title;
    const allWhite = song.steps.every((x) => x.colored === 0);
    $('#playerSub').textContent = song.subtitle + (allWhite ? ' · หน้านี้เป็นโพยลำดับ ไม่มีกริดสี' : '');
    $('#playerCode').textContent = st.code;
    $('#playerCounter').textContent = `เฟรม ${st.i + 1} / ${song.steps.length} · ทั้งงาน ${st.gi + 1}/${flat.length}`;
    const fsCode = $('#fsCode');
    if (fsCode) fsCode.textContent = `${st.code} · ${st.gi + 1}/${flat.length}`;
    const scrub = $('#scrub');
    scrub.min = '0';
    scrub.max = String(Math.round(SHOW_MS));
    scrub.step = '100';
    if (!state.desktopScrubActive) {
      scrub.value = String(Math.round(timelineMs()));
      setRange(scrub);
    }
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
    const nowMs = timelineMs();
    const pct = Math.max(0, Math.min(100, (nowMs / SHOW_MS) * 100));
    const codeEls = [$('#mhCode'), $('#thCode')];
    codeEls.forEach((el) => { if (el) el.textContent = st.code; });
    const ticker = `เฟรม ${st.gi + 1} / ${total}`;
    const counters = [$('#mhCounter'), $('#thCounter')];
    counters.forEach((el) => { if (el) el.textContent = ticker; });
    const time = $('#thTime');
    if (time) time.textContent = `${fmtMs(nowMs)} / ${fmtMs(SHOW_MS)}`;
    const fill = $('#thFill');
    if (fill) fill.style.width = pct + '%';
    const knob = $('#thKnob');
    if (knob) knob.style.left = pct + '%';
    const track = $('#thTrack');
    if (track) {
      track.setAttribute('aria-valuemin', '0');
      track.setAttribute('aria-valuemax', String(Math.round(SHOW_MS)));
      track.setAttribute('aria-valuenow', String(Math.round(nowMs)));
      track.setAttribute('aria-valuetext', `${fmtMs(nowMs)} จาก ${fmtMs(SHOW_MS)}`);
    }
    const frameLabel = $('#myFrameLabel');
    if (frameLabel) frameLabel.textContent = `${st.code} · เฟรม ${st.gi + 1}/${total}`;
    syncBpmInputs();
    syncScrubTime();
  }

  /* ---------- BPM ที่ปรับเอง (ค่าเริ่มต้น = bpm ของเพลง) ---------- */
  function syncBpmInputs() {
    const song = curSong();
    const val = String(Math.round(songBpm(song)));
    $$('.bpm-input').forEach((el) => {
      if (document.activeElement !== el) el.value = val;
      el.title = `BPM ที่เล่นอยู่ · ค่าเริ่มต้นของเพลง ${song.bpm} BPM`;
    });
    $$('.bpm-ctl').forEach((el) => {
      el.title = `BPM ของเพลง — แก้ได้ระหว่างซ้อม · ค่าเริ่มต้น ${song.bpm} BPM`;
    });
  }
  function setPlayBpm(raw) {
    const song = curSong();
    if (raw == null || String(raw).trim() === '') { syncBpmInputs(); return; }
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) { syncBpmInputs(); return; }
    const next = Math.min(BPM_MAX, Math.max(BPM_MIN, n));
    const prev = songBpm(song);
    if (next === song.bpm) delete song.playBpm;
    else song.playBpm = next;
    syncBpmInputs();
    if (next === prev) return;
    if (state.autoplay) {
      /* เปลี่ยน tempo กลางเพลง: คงตำแหน่งบีตปัจจุบัน ไม่กระโดดกลับต้นเฟรม */
      const pos = playPosBeat();
      anchorClock(pos);
      ensurePlayClock();
    }
    renderPlayer();
    showToast(next === song.bpm
      ? `BPM <b>${next}</b> · ค่าเริ่มต้นของเพลง`
      : `BPM <b>${next}</b> · ค่าเริ่มต้น ${song.bpm}`);
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

  /* token: "คำ" = เฉพาะครั้งแรก | "คำ#2" ครั้งที่ 2 | "คำ#1-3" ช่วง | "คำ#all" ทุกที่ */
  function highlightRanges(line, token) {
    const m = /^(.*?)#(all|\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)$/.exec(token);
    const text = m ? m[1] : token;
    if (!text) return [];
    const hits = [];
    let from = 0;
    while (from <= line.length - text.length) {
      const i = line.indexOf(text, from);
      if (i < 0) break;
      hits.push([i, i + text.length]);
      from = i + text.length;
    }
    if (!m) return hits.slice(0, 1);
    if (m[2] === 'all') return hits;
    const picked = [];
    m[2].split(',').forEach((part) => {
      const nums = part.split('-').map(Number);
      const end = nums.length > 1 ? nums[1] : nums[0];
      for (let n = nums[0]; n <= end; n += 1) {
        if (hits[n - 1]) picked.push(hits[n - 1]);
      }
    });
    return picked;
  }

  function lyricHTML(line, words, accent) {
    const meta = A.colors[accent] || { text: '#ffffff' };
    const ranges = [];
    (words || []).forEach((w) => {
      if (!w) return;
      ranges.push(...highlightRanges(line, w));
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
    const li = Number.isInteger(st.lyricLine) ? st.lyricLine - 1 : -1;
    const valid = li >= 0 && li < (song.lyrics || []).length;
    const line = valid ? song.lyrics[li] : '';
    const words = Array.isArray(st.lyricHighlight) ? st.lyricHighlight : [];
    $('#lyricCode').textContent = st.code;
    $('#lyricCount').textContent = valid ? `ท่อน ${li + 1}/${song.lyrics.length}` : '';
    const html = valid ? lyricHTML(line, words, lyricAccent(st)) : '';
    const lineEl = $('#lyricLine');
    lineEl.innerHTML = html || '— เฟรมแทรก ไม่มีคำร้อง —';
    lineEl.classList.toggle('is-empty', !valid);
    $('#lyricCue').textContent = st.cue || '—';
    /* subtitle ใน theater + เนื้อเพลงลอยบนแสตน + การ์ดของฉัน */
    const sub = $('#thSub');
    if (sub) {
      sub.innerHTML = html;
      sub.classList.toggle('is-empty', !valid);
      sub.hidden = !showLyrics || !valid;
    }
    const overlay = $('#standLyric');
    const overlayLine = $('#slLine');
    if (overlayLine) overlayLine.innerHTML = html || '';
    if (overlay) overlay.hidden = !showLyrics || !valid;
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
    const st = curStep();
    const end = Math.min(flat.length, st.gi + next.frames);
    if (!state.autoplay) {
      let ms = 0;
      for (let i = st.gi; i < end; i += 1) ms += flat[i].durMs;
      el.textContent = `อีก ${next.frames} เฟรม · ~${fmtSec(ms)} วินาที`;
      return;
    }
    let ms = state.nextAdvanceAt
      ? Math.max(0, state.nextAdvanceAt - Date.now())
      : framePlayMs(st);
    for (let i = st.gi + 1; i < end; i += 1) ms += framePlayMs(flat[i]);
    el.textContent = ms < 350
      ? 'กำลังจะเปลี่ยน'
      : `เปลี่ยนในอีก ${fmtSec(ms)} วินาที`;
  }

  function statsHTML(stt) {
    if (!stt) return '';
    const top = stt.topPlate;
    const topName = top ? (A.colors[top.hex] ? A.colors[top.hex].name : top.hex) : '—';
    return `
      <div class="my-stat"><b>${stt.transitions} ครั้ง</b><span>เปลี่ยนสี/ท่า</span></div>
      <div class="my-stat"><b>${flat.length} เฟรม</b><span>ทั้งโชว์</span></div>
      <div class="my-stat"><b>${stt.plateDistinct}/20 สี</b><span>เพลทที่ใช้</span></div>
      <div class="my-stat"><b>${stt.handFrames} เฟรม</b><span>ขึ้นมือ/พื้น</span></div>
      <div class="my-stat wide"><b>${top ? esc(topName) + ' · ' + top.n + ' เฟรม' : '—'}</b><span>สีคู่ใจ</span></div>`;
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
      const ident = $('#myIdent');
      if (ident) ident.hidden = true;
      const stats = $('#myStats');
      if (stats) stats.innerHTML = '';
      const badge = $('#myBadgeBtn');
      if (badge) badge.disabled = true;
      return;
    }
    card.classList.remove('is-empty');
    body.hidden = false;
    const st = curStep();
    const hex = st.colors[idx];
    if (label) label.textContent = state.seat;
    const stu = studentOf(state.seat);
    const ident = $('#myIdent');
    if (ident) {
      ident.hidden = !stu;
      if (stu) {
        $('#myIdentSeat').textContent = state.seat;
        $('#myIdentNick').textContent = 'น้อง' + stu.nickname;
        $('#myIdentName').textContent = stu.fullname;
        $('#myIdentMeta').textContent = `${stu.grade} · เลขที่ ${stu.studentNumber}`;
      }
    }
    const stats = $('#myStats');
    if (stats) stats.innerHTML = statsHTML(seatStats[idx]);
    const badge = $('#myBadgeBtn');
    if (badge) badge.disabled = !stu;
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
      const ident = $('#inspIdent');
      if (ident) ident.hidden = true;
      const stats = $('#inspStats');
      if (stats) stats.innerHTML = '';
      const badge = $('#inspBadgeBtn');
      if (badge) badge.disabled = true;
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
    const stu = studentOf(state.seat);
    const ident = $('#inspIdent');
    if (ident) {
      ident.hidden = !stu;
      if (stu) {
        $('#inspNick').textContent = 'น้อง' + stu.nickname;
        $('#inspFullname').textContent = stu.fullname;
        $('#inspMeta').textContent = `${stu.grade} · เลขที่ ${stu.studentNumber} · ${state.seat}`;
      }
    }
    const stats = $('#inspStats');
    if (stats) stats.innerHTML = statsHTML(seatStats[idx]);
    const badge = $('#inspBadgeBtn');
    if (badge) badge.disabled = !stu;
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
    const myBadge = $('#myBadgeBtn');
    if (myBadge) myBadge.disabled = !has;
    const inspBadge = $('#inspBadgeBtn');
    if (inspBadge) inspBadge.disabled = !has;
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
    if (window.GSBadge) window.GSBadge.sync(state.seat);
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
    const msAt = (clientX) => {
      const r = track.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width)));
      return t * SHOW_MS;
    };
    const preview = (clientX) => {
      const ms = msAt(clientX);
      state.dragMs = ms;
      goFast(frameAtMs(ms));
    };
    track.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dragging = true;
      stopPlaybackClock();
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
      state.dragMs = null;
      renderStandAll();
      updateHash();
      if (state.autoplay) scheduleNext();
    };
    track.addEventListener('pointerup', stop);
    track.addEventListener('pointercancel', stop);
    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      pokePlayer();
    });
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
    syncBpmInputs();
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
    on('#setMetro', toggleMetro);
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
        if (window.GSSearch) window.GSSearch.submit($('#setSearch'), { frame: true });
        else { closeSheet(); handleQuickSearch(v); }
        $('#setSearch').value = '';
      });
    }

    const myForm = $('#myForm');
    if (myForm) {
      myForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (window.GSSearch) {
          window.GSSearch.submit($('#myInput'), { frame: false });
          return;
        }
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
    on('#mhMetro', toggleMetro);
    on('#mhLyric', toggleLyrics);
    on('#thLyric', toggleLyrics);
    on('#thPlay', toggleAuto);
    on('#thCenterPlay', toggleAuto);
    on('#thMetro', toggleMetro);
    on('#mhExpand', toggleFull);
    on('#thPrev', prev);
    on('#thNext', next);
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
      if (state.autoplay) scheduleNext();
      showToast('เปิดหน้า <b>' + esc(song.title) + '</b>');
    });

    $('#btnPrev').addEventListener('click', prev);
    $('#btnNext').addEventListener('click', next);
    $('#btnPrevFs').addEventListener('click', prev);
    $('#btnNextFs').addEventListener('click', next);
    $('#btnPlay').addEventListener('click', toggleAuto);
    $('#btnMetro').addEventListener('click', toggleMetro);
    $$('.bpm-input').forEach((el) => {
      el.addEventListener('change', () => setPlayBpm(el.value));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
        else if (e.key === 'Escape') { syncBpmInputs(); el.blur(); }
      });
    });
    let scrubEndTimer = null;
    const finishScrub = () => {
      if (!state.desktopScrubActive) return;
      state.desktopScrubActive = false;
      state.dragMs = null;
      if (state.autoplay) scheduleNext();
      else renderPlayer();
    };
    const scrubEndSoon = () => {
      clearTimeout(scrubEndTimer);
      scrubEndTimer = setTimeout(finishScrub, 300);
    };
    $('#scrub').addEventListener('input', (e) => {
      const ms = Number(e.target.value);
      state.desktopScrubActive = true;
      state.dragMs = ms;
      stopPlaybackClock();
      setRange(e.target);
      goGlobal(frameAtMs(ms));
      scrubEndSoon();
    });
    $('#scrub').addEventListener('change', scrubEndSoon);
    $('#scrub').addEventListener('pointerup', scrubEndSoon);
    $('#scrub').addEventListener('blur', finishScrub);

    $('#stepPills').addEventListener('click', (e) => {
      const btn = e.target.closest('.step-pill');
      if (!btn) return;
      state.step = Number(btn.dataset.i);
      renderStandAll();
      updateHash();
      if (state.autoplay) scheduleNext();
    });

    $('#filmstrip').addEventListener('click', (e) => {
      const btn = e.target.closest('.film-item');
      if (!btn) return;
      state.step = Number(btn.dataset.i);
      renderStandAll();
      updateHash();
      if (state.autoplay) scheduleNext();
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
    const nicksBtn = $('#btnNicks');
    if (nicksBtn) {
      nicksBtn.addEventListener('click', () => {
        state.nicksOn = !state.nicksOn;
        $('#stageCard').classList.toggle('nicks-on', state.nicksOn);
        nicksBtn.classList.toggle('active', state.nicksOn);
        nicksBtn.setAttribute('aria-pressed', String(state.nicksOn));
        hideSeatTip();
      });
    }
    $$('[data-badge-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!state.seat) { showToast('เลือกที่นั่งก่อนดูป้ายประจำตัว'); return; }
        if (window.GSBadge) window.GSBadge.openModal(state.seat);
      });
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
      if (window.GSSearch) {
        window.GSSearch.submit($('#seatInput'), { frame: false });
        return;
      }
      const seat = normalizeSeat($('#seatInput').value);
      if (seat) { selectSeat(seat, { force: true }); showToast('เลือกที่นั่ง <b>' + seat + '</b>'); }
      else showToast('รหัสที่นั่งไม่ถูกต้อง — ใช้ A1 ถึง O10');
    });
    $('#seatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); $('#seatGo').click(); }
    });

    $('#searchForm').addEventListener('submit', (e) => {
      e.preventDefault();
      if (window.GSSearch) window.GSSearch.submit($('#quickSeat'), { frame: true });
      else handleQuickSearch($('#quickSeat').value);
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
      else if (e.key === 'm' || e.key === 'M') toggleMetro();
      else if (e.key === '1') setView('stand');
      else if (e.key === '2') setView('songbook');
      else if (e.key === '3') setView('gallery');
      else if (e.key === '4') setView('analysis');
      else if (e.key === '5') setView('badge');
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
  function init() {
    if (!readHash()) applyDefaultStep();
    buildStandGrid();
    $('#gSong').innerHTML = '<option value="all">ทุกหน้า (10)</option>'
      + songs.map((s) => `<option value="${s.si}">${s.id}. ${esc(s.title)}</option>`).join('');
    $('#chipSteps').textContent = String(flat.length);
    bindEvents();
    wireRailButtons();
    wireGestures();
    wireScrubber();
    wirePlayerUI();
    wireSeatTips();
    setView(state.view);
    syncFullBtn();
    updatePlayerMode();
    updateMetroBtn();
    updateLyricBtn();
    applyZoom();
    setInterval(() => {
      if (!state.autoplay) return;
      renderPlayerChrome();
      if (!state.seat) return;
      const idx = seatIndex();
      if (idx < 0) return;
      const next = seatNextInfo(idx);
      if (next) updateMyEta(next);
    }, 250);
    requestAnimationFrame(() => {
      ['songTabs', 'stepPills', 'filmstrip', 'standWrap'].forEach(updateRail);
    });
  }

  /* โมดูลเสริมโหลดมาก่อน app.js — เปิด API กลางให้แล้วเรียก init ตามลำดับ */
  window.GS = {
    A,
    COLS,
    ROWS,
    COL_INDEX,
    SEATS,
    SEAT_INDEX,
    PALETTE,
    songs,
    flat,
    seatStats,
    state,
    $,
    $$,
    esc,
    normalizeSeat,
    miniHTML,
    readableText,
    seatRow,
    seatCol,
    selectSeat,
    clearSeat,
    setView,
    showToast,
    refreshSeatUI,
    seatNextInfo,
    renderStandAll,
    closeSheet,
    seatIndex,
    goGlobal,
    curStep,
    applyFrame,
  };

  if (window.GSWelcome) window.GSWelcome.init();
  if (window.GSSearch) window.GSSearch.init();
  if (window.GSBadge) window.GSBadge.init();

  init();
})();
