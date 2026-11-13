/* global APP_DATA */
/* ============================================================
   GSStudents — index ชื่อนักเรียน 150 คน (ข้อมูลปลอดภัยเท่านั้น)
   ใช้ร่วมกับ app.js ผ่าน window.GSStudents
   ============================================================ */
(function () {
  'use strict';

  const raw = (APP_DATA && APP_DATA.students) || {};
  const list = Object.values(raw);

  /* เรียงตามลำดับผังเดียวกับ SEATS (แถว 10 → 1, คอลัมน์ A → O) */
  const bySeat = new Map();
  list.forEach((s) => { if (s && s.position) bySeat.set(s.position, s); });

  const byNickname = new Map();
  const byClass = new Map();
  list.forEach((s) => {
    if (!s) return;
    if (!byNickname.has(s.nickname)) byNickname.set(s.nickname, []);
    byNickname.get(s.nickname).push(s);
    if (!byClass.has(s.grade)) byClass.set(s.grade, []);
    byClass.get(s.grade).push(s);
  });

  function get(seat) {
    return bySeat.get(seat) || null;
  }

  function displayName(seat) {
    const s = get(seat);
    return s ? 'น้อง' + s.nickname : '';
  }

  function dupCount(s) {
    const group = byNickname.get(s.nickname);
    return group ? group.length : 1;
  }

  function toResult(s) {
    return {
      seat: s.position,
      nickname: s.nickname,
      fullname: s.fullname,
      grade: s.grade,
      studentNumber: s.studentNumber,
      classroomCode: s.classroomCode,
      duplicateCount: dupCount(s),
    };
  }

  const norm = (v) => String(v == null ? '' : v).toLowerCase().replace(/\s+/g, ' ').trim();

  /* ค้นหาแบบจัดอันดับ: ที่นั่งเป๊ะ → ชื่อเล่นเป๊ะ → นำหน้า → มีในชื่อ →
     ชื่อจริง → ชั้น/ห้อง/เลขที่ → ที่นั่งนำหน้า → หลายคำพร้อมกัน */
  function search(q, limit = 8) {
    const query = norm(q);
    if (!query) return [];
    const tokens = query.split(' ').filter(Boolean);
    const scored = [];

    for (const s of list) {
      const seat = s.position.toLowerCase();
      const nick = norm(s.nickname);
      const full = norm(s.fullname);
      const grade = norm(s.grade); // ม.1/4
      const gradeShort = grade.replace(/^ม\./, ''); // 1/4
      const cls = String(s.classroomCode || '').toLowerCase();
      const num = String(s.studentNumber || '').toLowerCase();
      let score = 0;

      if (seat === query) score = 1000;
      else if (nick === query) score = 900;
      else if (nick.startsWith(query)) score = 820;
      else if (nick.includes(query)) score = 740;
      else if (full.includes(query)) score = 660;
      else if (grade === query || gradeShort === query || cls === query || num === query) score = 600;
      else if (seat.startsWith(query)) score = 480;
      else if (tokens.length > 1 && tokens.every((t) => (
        seat.includes(t) || nick.includes(t) || full.includes(t)
        || grade.includes(t) || gradeShort.includes(t) || cls.includes(t) || num === t
      ))) score = 320;

      if (score > 0) {
        /* ตัวเลขล้วน 1–2 หลักที่ตรงเลขที่ ให้โอกาสน้อยกว่าชั้น/ที่นั่งชัด ๆ */
        if (/^\d{1,2}$/.test(query) && num === query) score += 20;
        scored.push({ s, score });
      }
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ai = bySeatOrder(a.s);
      const bi = bySeatOrder(b.s);
      return ai - bi;
    });

    return scored.slice(0, limit).map((x) => toResult(x.s));
  }

  const ORDER = new Map();
  list.forEach((s, i) => ORDER.set(s.position, i));
  function bySeatOrder(s) {
    return ORDER.has(s.position) ? ORDER.get(s.position) : 999;
  }

  /* resolve: คืนที่นั่งเมื่อผู้ชนะชัดเจนเท่านั้น
     ชื่อซ้ำหรือกำกวม → คืนรายการให้ผู้ใช้เลือก */
  function resolve(q) {
    const query = norm(q);
    if (!query) return { empty: true };
    const exactSeat = query.toUpperCase().match(/^([A-O])(10|[1-9])$/);
    if (exactSeat && bySeat.has(exactSeat[1] + exactSeat[2])) {
      return { seat: exactSeat[1] + exactSeat[2] };
    }
    const results = search(query, 12);
    if (!results.length) return { empty: true };
    const top = results[0];
    const topScoreGroup = results.filter((r) => (
      norm(r.nickname) === query || r.seat.toLowerCase() === query || norm(r.fullname) === query
    ));
    if (topScoreGroup.length === 1) return { seat: topScoreGroup[0].seat };
    if (topScoreGroup.length > 1) return { ambiguous: topScoreGroup, results };
    if (results.length === 1) return { seat: results[0].seat };
    /* ชื่อเล่นซ้ำ: search คืนทุกคนที่ตรงชื่อ */
    if (top.duplicateCount > 1 && norm(top.nickname) === query) {
      const same = list.filter((s) => norm(s.nickname) === query).map(toResult);
      return { ambiguous: same, results };
    }
    return { ambiguous: results, results };
  }

  window.GSStudents = {
    list,
    bySeat,
    byNickname,
    byClass,
    get,
    displayName,
    search,
    resolve,
    dupCount,
  };
}());
