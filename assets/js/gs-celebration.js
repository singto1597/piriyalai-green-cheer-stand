/* ============================================================
   GSConfetti + GSWelcome — ฉลองแชมป์ 3 รายการ
   vanilla canvas, ไม่ใช้ไลบรารีภายนอก
   ============================================================ */
(function () {
  'use strict';

  const COLORS = ['#548235', '#6aa84f', '#ffd166', '#f4c542', '#ffffff', '#14532d'];
  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let canvas = null;
  let ctx = null;
  let raf = 0;
  let parts = [];
  let W = 0;
  let H = 0;
  let dpr = 1;
  let startedAt = 0;
  let running = false;

  function setup() {
    if (canvas && ctx) return true;
    canvas = document.getElementById('champCanvas');
    if (!canvas) return false;
    ctx = canvas.getContext('2d');
    return Boolean(ctx);
  }

  function sizeCanvas() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
  }

  function spawn() {
    const count = REDUCED ? 70 : Math.min(260, Math.max(140, Math.round(W / 6)));
    const origins = [
      { x: -W * 0.04, y: H * 0.42, dir: 1 },
      { x: W * 1.04, y: H * 0.42, dir: -1 },
      { x: W * 0.5, y: -H * 0.05, dir: Math.random() < 0.5 ? -1 : 1 },
    ];
    parts = [];
    for (let i = 0; i < count; i += 1) {
      const o = origins[i % origins.length];
      const spread = (Math.random() - 0.5) * 0.9;
      const power = 9 + Math.random() * 12;
      parts.push({
        x: o.x + (Math.random() - 0.5) * 30,
        y: o.y + (Math.random() - 0.5) * 40,
        vx: Math.cos(spread) * power * o.dir * (o.dir === 1 ? 1 : 1),
        vy: -Math.abs(Math.sin(spread) * power) - (2 + Math.random() * 6),
        w: 4 + Math.random() * 6,
        h: 7 + Math.random() * 11,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.32,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        ribbon: Math.random() < 0.34,
        sway: Math.random() * Math.PI * 2,
        swaySpeed: 0.02 + Math.random() * 0.04,
        drag: 0.985 + Math.random() * 0.01,
      });
    }
    /* ยิงจากกลางบนให้กระจายทั้งสองทาง */
    const half = Math.floor(parts.length / 3);
    for (let i = 0; i < half; i += 1) {
      const p = parts[i * 3];
      if (!p) continue;
      p.vx = (Math.random() - 0.5) * 14;
      p.vy = -6 - Math.random() * 9;
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.sway += p.swaySpeed;
      p.vx *= p.drag;
      p.vy = p.vy * 0.995 + 0.16;
      p.x += p.vx + Math.sin(p.sway) * 0.9;
      p.y += p.vy;
      p.rot += p.vr;
      if (p.y > H + 40 && p.vy > 0) {
        p.y = -30;
        p.x = Math.random() * W;
        p.vy = 1 + Math.random() * 2;
        p.vx *= 0.4;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = p.color;
      if (p.ribbon) ctx.fillRect(-p.w * 0.28, -p.h * 0.5, p.w * 0.56, p.h);
      else ctx.fillRect(-p.w * 0.5, -p.h * 0.28, p.w, p.h * 0.56);
      ctx.restore();
    }
  }

  function tick(now) {
    if (!running) return;
    if (!startedAt) startedAt = now;
    draw();
    if (now - startedAt > (REDUCED ? 2200 : 5600)) {
      stop();
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  function fire() {
    if (!setup()) return;
    stop();
    sizeCanvas();
    spawn();
    startedAt = 0;
    running = true;
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  window.GSConfetti = { fire, stop };

  /* ---------------------------------------------------------
     GSWelcome — เปิดทุกครั้งที่โหลดหน้า + ปุ่มเปิดซ้ำ
     --------------------------------------------------------- */
  const GSWelcome = {
    modal: null,
    isOpen: false,
    lastFocus: null,
    stopTimer: 0,

    init() {
      this.modal = document.getElementById('champModal');
      if (!this.modal) return;
      const self = this;

      const bind = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', fn);
      };

      const open = () => self.open();
      bind('btnChamp', open);
      bind('btnChampSide', open);
      bind('setChamp', () => {
        if (window.GS && window.GS.closeSheet) window.GS.closeSheet();
        open();
      });
      bind('champReplay', () => {
        window.GSConfetti.stop();
        window.GSConfetti.fire();
      });
      bind('champCta', () => {
        const GS = window.GS;
        const seat = GS && GS.state ? GS.state.seat : null;
        self.close();
        if (!GS) return;
        GS.setView('stand');
        if (seat && window.GSBadge) {
          window.GSBadge.openModal(seat);
          return;
        }
        const input = document.getElementById('myInput');
        if (input) setTimeout(() => input.focus({ preventScroll: true }), 180);
        GS.showToast('เลือกที่นั่งของตัวเอง แล้วเปิดการ์ดที่ระลึกได้เลย');
      });

      this.modal.addEventListener('click', (e) => {
        if (e.target === self.modal) self.close();
      });
      document.addEventListener('keydown', (e) => {
        if (!self.isOpen) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          self.close();
          return;
        }
        if (e.key === 'Tab') self.trapFocus(e);
      });

      /* เปิดทุกครั้งที่โหลดหน้า (ไม่มี localStorage) */
      setTimeout(() => self.open(), 420);
    },

    trapFocus(e) {
      const focusables = Array.from(this.modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )).filter((el) => !el.disabled && el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || !this.modal.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !this.modal.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    },

    open() {
      if (!this.modal || this.isOpen) return;
      this.isOpen = true;
      this.lastFocus = document.activeElement;
      this.modal.classList.add('is-open');
      this.modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('champ-open');
      const cta = document.getElementById('champCta');
      requestAnimationFrame(() => {
        if (!this.isOpen) return;
        window.GSConfetti.fire();
        if (cta) cta.focus({ preventScroll: true });
      });
      clearTimeout(this.stopTimer);
      this.stopTimer = setTimeout(() => window.GSConfetti.stop(), 6800);
    },

    close() {
      if (!this.modal || !this.isOpen) return;
      this.isOpen = false;
      this.modal.classList.remove('is-open');
      this.modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('champ-open');
      clearTimeout(this.stopTimer);
      window.GSConfetti.stop();
      if (this.lastFocus && typeof this.lastFocus.focus === 'function') {
        this.lastFocus.focus({ preventScroll: true });
      }
    },
  };

  window.GSWelcome = GSWelcome;
}());
