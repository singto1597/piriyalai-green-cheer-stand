/* ============================================================
   GSSearch — autocomplete อัจฉริยะ (ชื่อเล่น / ชื่อจริง / ชั้น / ที่นั่ง / เฟรม)
   ใช้ portal #saPortal แบบ position:fixed เพื่อไม่ให้ถูก clip
   ============================================================ */
(function () {
  'use strict';

  const menu = document.getElementById('saPortal');
  let activeInput = null;
  let activeOpts = {};
  let activeIndex = -1;
  let items = [];
  let ownScroll = false;

  const GS = () => window.GS;
  const students = () => window.GSStudents;

  function isOpen() {
    return Boolean(menu && !menu.hidden);
  }

  function closeMenu() {
    if (!menu) return;
    menu.hidden = true;
    menu.innerHTML = '';
    items = [];
    activeIndex = -1;
    if (activeInput) {
      activeInput.setAttribute('aria-expanded', 'false');
      activeInput.removeAttribute('aria-activedescendant');
    }
    activeInput = null;
    activeOpts = {};
  }

  function optionId(i) {
    return 'sa-opt-' + i;
  }

  function place() {
    if (!activeInput || !menu) return;
    const r = activeInput.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(r.width, 310), vw - 16);
    menu.style.width = width + 'px';
    menu.style.minWidth = width + 'px';
    const mh = Math.min(menu.scrollHeight || 300, vh * 0.52);
    let top = r.bottom + 6;
    if (top + mh > vh - 8) top = Math.max(8, r.top - mh - 6);
    const left = Math.min(Math.max(8, r.left), vw - width - 8);
    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
  }

  function itemHTML(item, i) {
    if (item.type === 'frame') {
      const st = GS().flat[item.n - 1];
      const title = st ? `ไปเฟรม ${item.n} · ${st.code}` : `ไปเฟรม ${item.n}`;
      const sub = st ? `${st.name || ''}` : '';
      return `<button type="button" class="sa-item sa-frame" role="option" id="${optionId(i)}" data-frame="${item.n}">
        <span class="sa-seat">#${item.n}</span>
        <span class="sa-main"><b>${escapeHtml(title)}</b><span>${escapeHtml(sub)}</span></span>
        <span class="sa-side"><span class="sa-grade">เฟรม</span></span>
      </button>`;
    }
    const r = item.result;
    const dup = r.duplicateCount > 1 ? `<span class="sa-dup">ชื่อซ้ำ ×${r.duplicateCount}</span>` : '';
    return `<button type="button" class="sa-item" role="option" id="${optionId(i)}" data-seat="${r.seat}">
      <span class="sa-seat">${r.seat}</span>
      <span class="sa-main"><b>น้อง${escapeHtml(r.nickname)}</b><span>${escapeHtml(r.fullname)}</span></span>
      <span class="sa-side"><span class="sa-grade">${escapeHtml(r.grade)} · เลขที่ ${escapeHtml(r.studentNumber)}</span>${dup}</span>
    </button>`;
  }

  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function render() {
    if (!activeInput || !students()) return;
    const q = activeInput.value.trim();
    items = [];
    if (q) {
      const results = students().search(q, 8);
      results.forEach((r) => items.push({ type: 'seat', result: r }));
      if (activeOpts.frame) {
        const n = parseInt(q.replace(/[^\d]/g, ''), 10);
        if (n >= 1 && n <= GS().flat.length && !results.length) {
          items.push({ type: 'frame', n });
        }
      }
    }
    if (!items.length) {
      menu.innerHTML = `<div class="sa-empty">ไม่พบ “${escapeHtml(q)}” — ลองชื่อเล่น ชื่อจริง ม.1/4 หรือที่นั่ง A1</div>`;
      menu.hidden = false;
      activeInput.setAttribute('aria-expanded', 'true');
      activeIndex = -1;
      place();
      return;
    }
    menu.innerHTML = items.map(itemHTML).join('');
    menu.hidden = false;
    activeInput.setAttribute('aria-expanded', 'true');
    activeIndex = -1;
    place();
  }

  function setActive(i) {
    if (!items.length) return;
    activeIndex = ((i % items.length) + items.length) % items.length;
    const nodes = menu.querySelectorAll('.sa-item');
    nodes.forEach((el, k) => el.classList.toggle('active', k === activeIndex));
    const node = nodes[activeIndex];
    if (node) {
      activeInput.setAttribute('aria-activedescendant', node.id);
      const top = node.offsetTop;
      if (top < menu.scrollTop) menu.scrollTop = top - 4;
      else if (top + node.offsetHeight > menu.scrollTop + menu.clientHeight) {
        menu.scrollTop = top + node.offsetHeight - menu.clientHeight + 4;
      }
    }
  }

  function pickSeat(seat, input, opts) {
    const gs = GS();
    if (!gs) return;
    gs.selectSeat(seat, { force: true });
    if (!opts.stayView) gs.setView('stand');
    if (document.body.classList.contains('sheet-open') && gs.closeSheet) gs.closeSheet();
    const stu = students() ? students().get(seat) : null;
    const who = stu ? ` · น้อง${stu.nickname} (${stu.grade})` : '';
    gs.showToast('ไปที่ที่นั่ง <b>' + seat + '</b>' + who);
    if (input) input.value = seat;
    closeMenu();
  }

  function pickFrame(n, input) {
    const gs = GS();
    if (!gs) return;
    gs.goGlobal(n - 1);
    gs.setView('stand');
    if (document.body.classList.contains('sheet-open') && gs.closeSheet) gs.closeSheet();
    const st = gs.flat[n - 1];
    gs.showToast('ไปที่เฟรม <b>' + n + '</b>' + (st ? ' · ' + st.code + ' ' + st.name : ''));
    if (input) input.value = '';
    closeMenu();
  }

  function pick(item, input, opts) {
    if (!item) return;
    if (item.type === 'frame') pickFrame(item.n, input);
    else pickSeat(item.result.seat, input, opts);
  }

  function frameFrom(value, opts) {
    if (!opts.frame) return 0;
    const n = parseInt(String(value).replace(/[^\d]/g, ''), 10);
    return n >= 1 && n <= GS().flat.length ? n : 0;
  }

  function openFor(input, opts) {
    activeInput = input;
    activeOpts = opts || {};
    render();
  }

  /* ใช้โดยฟอร์ม submit / ปุ่ม “ไป” */
  function submit(input, opts = {}) {
    if (!input || !GS()) return false;
    const raw = input.value.trim();
    if (!raw) {
      GS().showToast('พิมพ์ชื่อเล่น ชื่อจริง ชั้น หรือรหัสที่นั่ง');
      return false;
    }
    const res = students() ? students().resolve(raw) : { empty: true };
    if (res.seat) {
      pickSeat(res.seat, input, opts);
      return true;
    }
    if (res.ambiguous && res.ambiguous.length) {
      activeInput = input;
      activeOpts = opts;
      render();
      const names = new Set(res.ambiguous.map((r) => String(r.nickname).trim().toLowerCase()));
      if (names.size === 1) {
        const extra = res.ambiguous.length > 1 ? ` ×${res.ambiguous.length}` : '';
        GS().showToast(
          `ชื่อเล่น “<b>${escapeHtml(res.ambiguous[0].nickname)}</b>” ซ้ำ${extra} — เลือกที่นั่งให้ถูกคน`
        );
      } else {
        GS().showToast('พบหลายที่นั่ง — เลือกจากรายการด้านล่าง');
      }
      if (res.ambiguous.length === 1) pickSeat(res.ambiguous[0].seat, input, opts);
      return true;
    }
    const n = frameFrom(raw, opts);
    if (n) {
      pickFrame(n, input);
      return true;
    }
    GS().showToast('ไม่พบ “' + escapeHtml(raw) + '” — ลองชื่อเล่น ชื่อจริง ม.1/4 หรือ A1');
    return false;
  }

  function attach(input, opts = {}) {
    if (!input) return;
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', 'saPortal');
    input.setAttribute('aria-expanded', 'false');
    input.dataset.saLimit = String(opts.limit || 8);

    let timer = 0;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (input.value.trim()) openFor(input, opts);
        else closeMenu();
      }, 80);
    });
    input.addEventListener('focus', () => {
      if (input.value.trim()) openFor(input, opts);
    });
    input.addEventListener('click', () => {
      if (input.value.trim()) openFor(input, opts);
    });

    input.addEventListener('keydown', (e) => {
      const open = isOpen() && activeInput === input;
      if (e.key === 'ArrowDown') {
        if (!open) { openFor(input, opts); return; }
        e.preventDefault();
        setActive(activeIndex + 1);
      } else if (e.key === 'ArrowUp') {
        if (!open) return;
        e.preventDefault();
        setActive(activeIndex - 1);
      } else if (e.key === 'Enter') {
        if (open && activeIndex >= 0) {
          e.preventDefault();
          pick(items[activeIndex], input, opts);
        }
      } else if (e.key === 'Escape') {
        if (open) {
          e.preventDefault();
          closeMenu();
        }
      }
    });

    input.addEventListener('blur', () => {
      setTimeout(() => {
        if (document.activeElement && menu.contains(document.activeElement)) return;
        if (activeInput === input) closeMenu();
      }, 140);
    });
  }

  if (menu) {
    menu.addEventListener('mousedown', (e) => e.preventDefault());
    menu.addEventListener('click', (e) => {
      const btn = e.target.closest('.sa-item');
      if (!btn) return;
      const input = activeInput;
      const opts = activeOpts;
      if (btn.dataset.seat) pickSeat(btn.dataset.seat, input, opts);
      else if (btn.dataset.frame) pickFrame(Number(btn.dataset.frame), input);
    });
    menu.addEventListener('scroll', () => { ownScroll = true; });
  }

  function init() {
    attach(document.getElementById('quickSeat'), { frame: true });
    attach(document.getElementById('myInput'), { frame: false });
    attach(document.getElementById('seatInput'), { frame: false });
    attach(document.getElementById('setSearch'), { frame: true });
    attach(document.getElementById('badgeSeatInput'), { frame: false, stayView: true });

    document.addEventListener('pointerdown', (e) => {
      if (!isOpen()) return;
      if (menu.contains(e.target) || e.target === activeInput) return;
      closeMenu();
    });

    window.addEventListener('resize', () => { if (isOpen()) place(); });
    window.addEventListener('scroll', () => {
      if (!isOpen() || ownScroll) { ownScroll = false; return; }
      place();
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen() && !(document.activeElement && menu.contains(document.activeElement))) {
        closeMenu();
      }
    });
  }

  window.GSSearch = { init, submit, closeMenu, isOpen };
}());
