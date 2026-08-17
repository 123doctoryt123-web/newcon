/* ==========================================================================
   CONNECT THREE — FX layer
   Everything here is decorative. It must never block, hide, or break content,
   so every effect is additive and guarded:
     - honours prefers-reduced-motion
     - skips itself on low-end devices (set by experience.js quality guard)
     - never changes layout, only transforms/opacity on top of existing DOM
   Exposes window.CTFX for pages that want to fire effects directly.
   ========================================================================== */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE    = window.matchMedia('(pointer: fine)').matches;
  var CTFX    = {};
  window.CTFX = CTFX;

  function lowPower() { return document.documentElement.dataset.gfx === 'low'; }

  /* ----------------------------------------------------------- haptics */
  CTFX.haptic = function (pattern) {
    try { if (navigator.vibrate && !REDUCED) navigator.vibrate(pattern || 12); } catch (e) {}
  };

  /* ---------------------------------------------------------- count up */
  CTFX.countTo = function (node, to, ms) {
    if (!node) return;
    to = Number(to) || 0;
    if (REDUCED) { node.textContent = to; return; }
    var t0 = performance.now(), dur = ms || 1100;
    (function step(now) {
      var p = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - p, 4);
      node.textContent = Math.round(to * e);
      if (p < 1) requestAnimationFrame(step);
      else node.textContent = to;
    })(t0);
  };

  /* ---------------------------------------------------------- confetti */
  var confCanvas = null, confCtx = null, confParts = [], confRAF = 0;
  CTFX.confetti = function (opts) {
    if (REDUCED || lowPower()) return;
    opts = opts || {};
    if (!confCanvas) {
      confCanvas = document.createElement('canvas');
      confCanvas.style.cssText =
        'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9995;';
      document.body.appendChild(confCanvas);
      confCtx = confCanvas.getContext('2d');
      sizeConf();
      window.addEventListener('resize', sizeConf);
    }
    var colors = opts.colors || ['#D4A257', '#F0C880', '#D25F42', '#4A9C86', '#F2EDE1'];
    var n = opts.count || 90;
    var ox = opts.x != null ? opts.x : window.innerWidth / 2;
    var oy = opts.y != null ? opts.y : window.innerHeight * 0.34;
    for (var i = 0; i < n; i++) {
      var a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      var sp = 5 + Math.random() * 9;
      confParts.push({
        x: ox, y: oy,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4,
        w: 5 + Math.random() * 7, h: 8 + Math.random() * 8,
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
        c: colors[(Math.random() * colors.length) | 0],
        life: 1
      });
    }
    if (!confRAF) confRAF = requestAnimationFrame(confLoop);
  };
  function sizeConf() {
    if (!confCanvas) return;
    var d = Math.min(window.devicePixelRatio, 2);
    confCanvas.width = window.innerWidth * d;
    confCanvas.height = window.innerHeight * d;
    confCtx.setTransform(d, 0, 0, d, 0, 0);
  }
  function confLoop() {
    confCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (var i = confParts.length - 1; i >= 0; i--) {
      var p = confParts[i];
      p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy;
      p.rot += p.vr; p.life -= 0.008;
      if (p.life <= 0 || p.y > window.innerHeight + 60) { confParts.splice(i, 1); continue; }
      confCtx.save();
      confCtx.translate(p.x, p.y); confCtx.rotate(p.rot);
      confCtx.globalAlpha = Math.max(0, Math.min(1, p.life));
      confCtx.fillStyle = p.c;
      confCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      confCtx.restore();
    }
    if (confParts.length) confRAF = requestAnimationFrame(confLoop);
    else { confRAF = 0; confCtx.clearRect(0, 0, window.innerWidth, window.innerHeight); }
  }

  /* ------------------------------------------------------------- toast */
  CTFX.toast = function (msg, kind) {
    var wrap = document.getElementById('ctfx-toasts');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'ctfx-toasts';
      document.body.appendChild(wrap);
    }
    var t = document.createElement('div');
    t.className = 'ctfx-toast' + (kind ? ' ' + kind : '');
    t.textContent = msg;
    wrap.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('in'); });
    setTimeout(function () {
      t.classList.remove('in');
      setTimeout(function () { t.remove(); }, 400);
    }, 3200);
  };

  if (REDUCED) return;   // everything below is pure motion

  /* ------------------------------------------------------------ ripple */
  document.addEventListener('pointerdown', function (e) {
    var host = e.target.closest('.btn, .gate, .tab, .step-btn, .logout-link, .ct-utils button');
    if (!host || lowPower()) return;
    var r = host.getBoundingClientRect();
    var s = Math.max(r.width, r.height) * 2;
    var d = document.createElement('span');
    d.className = 'ctfx-ripple';
    d.style.width = d.style.height = s + 'px';
    d.style.left = (e.clientX - r.left - s / 2) + 'px';
    d.style.top = (e.clientY - r.top - s / 2) + 'px';
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(d);
    setTimeout(function () { d.remove(); }, 650);
    CTFX.haptic(10);
  }, { passive: true });

  /* ------------------------------------------- magnetic + tilt (mouse) */
  if (FINE) {
    var magnets = [];
    function collectMagnets() {
      magnets = [].slice.call(document.querySelectorAll('.btn, .ct-utils button, .logout-link'));
    }
    collectMagnets();
    new MutationObserver(collectMagnets).observe(document.body, { childList: true, subtree: true });

    window.addEventListener('mousemove', function (e) {
      if (lowPower()) return;
      for (var i = 0; i < magnets.length; i++) {
        var m = magnets[i];
        var r = m.getBoundingClientRect();
        if (!r.width) continue;
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        var dx = e.clientX - cx, dy = e.clientY - cy;
        var dist = Math.hypot(dx, dy);
        var range = Math.max(r.width, r.height) * 0.9 + 40;
        if (dist < range) {
          var k = (1 - dist / range) * 0.28;
          m.style.transform = 'translate(' + dx * k + 'px,' + dy * k + 'px)';
        } else if (m.style.transform) {
          m.style.transform = '';
        }
      }
    }, { passive: true });

    // 3D tilt on cards / gates
    document.addEventListener('pointermove', function (e) {
      if (lowPower()) return;
      var c = e.target.closest('.gate, .card');
      if (!c || c.dataset.noTilt) return;
      // .ct-rv animates with its own transform — don't overwrite it mid-reveal
      if (c.classList.contains('ct-rv') && !c.classList.contains('in')) return;
      var r = c.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      c.style.transform = 'perspective(900px) rotateX(' + (-py * 5).toFixed(2) +
        'deg) rotateY(' + (px * 6).toFixed(2) + 'deg) translateY(-3px)';
      c.style.transition = 'transform .12s linear';
    }, { passive: true });
    document.addEventListener('pointerout', function (e) {
      var c = e.target.closest('.gate, .card');
      if (!c) return;
      c.style.transition = '';
      c.style.transform = '';
    }, { passive: true });
  }

  /* ----------------------------------------------- word-reveal headings */
  function splitWords(node) {
    if (node.dataset.split) return;
    node.dataset.split = '1';
    var text = node.textContent;
    node.textContent = '';
    // Arabic joins its letters — split on WORDS only, never characters.
    text.split(/(\s+)/).forEach(function (tok, i) {
      if (!tok.trim()) { node.appendChild(document.createTextNode(tok)); return; }
      var w = document.createElement('span'); w.className = 'ctfx-w';
      var it = document.createElement('i'); it.textContent = tok;
      it.style.transitionDelay = (i * 0.05) + 's';
      w.appendChild(it); node.appendChild(w);
    });
  }
  var heads = [].slice.call(document.querySelectorAll('h1.display, .container > h1, .container > h2'));
  heads.forEach(splitWords);
  if ('IntersectionObserver' in window) {
    var hio = new IntersectionObserver(function (en) {
      en.forEach(function (x) {
        if (x.isIntersecting) { x.target.classList.add('go'); hio.unobserve(x.target); }
      });
    }, { threshold: 0.2 });
    heads.forEach(function (h) { hio.observe(h); });
    // failsafe: headings must never stay invisible
    setTimeout(function () { heads.forEach(function (h) { h.classList.add('go'); }); }, 4000);
  } else {
    heads.forEach(function (h) { h.classList.add('go'); });
  }

  /* --------------------------------------------- auto count-up numbers */
  function autoCount() {
    var nodes = document.querySelectorAll('[data-count], .score-digit, .stat-num, .points-val');
    nodes.forEach(function (n) {
      if (n.dataset.counted) return;
      var v = parseInt((n.dataset.count || n.textContent || '').replace(/[^\d-]/g, ''), 10);
      if (isNaN(v)) return;
      n.dataset.counted = '1';
      n.textContent = '0';
      CTFX.countTo(n, v, 1000);
    });
  }
  setTimeout(autoCount, 600);
  new MutationObserver(function () { clearTimeout(window.__ctfxAC); window.__ctfxAC = setTimeout(autoCount, 400); })
    .observe(document.body, { childList: true, subtree: true });

  /* ------------------------------------------------- parallax on scroll */
  var paraEls = [];
  function collectPara() { paraEls = [].slice.call(document.querySelectorAll('.gate, .card')); }
  collectPara();
  new MutationObserver(collectPara).observe(document.body, { childList: true, subtree: true });

  var lastY = window.scrollY, vel = 0;
  window.addEventListener('scroll', function () {
    vel = window.scrollY - lastY; lastY = window.scrollY;
  }, { passive: true });

  (function skewLoop() {
    requestAnimationFrame(skewLoop);
    if (lowPower() || !FINE) return;
    vel *= 0.9;
    var s = Math.max(-2.2, Math.min(2.2, vel * 0.06));
    if (Math.abs(s) < 0.02) return;
    for (var i = 0; i < paraEls.length; i++) {
      var el = paraEls[i];
      if (el.style.transform && el.style.transform.indexOf('perspective') > -1) continue;
      // same reason as the tilt guard: reveal owns transform until it's done
      if (el.classList.contains('ct-rv') && !el.classList.contains('in')) continue;
      var r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) continue;
      el.style.transform = 'skewY(' + s.toFixed(2) + 'deg)';
    }
  })();

  /* ------------------------------------------------- cursor spark trail */
  if (FINE) {
    var trail = [], tCanvas, tCtx, tRAF = 0;
    window.addEventListener('mousemove', function (e) {
      if (lowPower()) return;
      if (!tCanvas) {
        tCanvas = document.createElement('canvas');
        tCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9989;';
        document.body.appendChild(tCanvas);
        tCtx = tCanvas.getContext('2d');
        var d = Math.min(window.devicePixelRatio, 2);
        tCanvas.width = innerWidth * d; tCanvas.height = innerHeight * d;
        tCtx.setTransform(d, 0, 0, d, 0, 0);
        window.addEventListener('resize', function () {
          var dd = Math.min(window.devicePixelRatio, 2);
          tCanvas.width = innerWidth * dd; tCanvas.height = innerHeight * dd;
          tCtx.setTransform(dd, 0, 0, dd, 0, 0);
        });
      }
      trail.push({ x: e.clientX, y: e.clientY, life: 1 });
      if (trail.length > 26) trail.shift();
      if (!tRAF) tRAF = requestAnimationFrame(trailLoop);
    }, { passive: true });

    function trailLoop() {
      tCtx.clearRect(0, 0, innerWidth, innerHeight);
      for (var i = 0; i < trail.length; i++) {
        var p = trail[i];
        p.life -= 0.045;
        if (p.life <= 0) continue;
        tCtx.beginPath();
        tCtx.arc(p.x, p.y, 1.6 + p.life * 2.6, 0, 6.283);
        tCtx.fillStyle = 'rgba(212,162,87,' + (p.life * 0.5).toFixed(3) + ')';
        tCtx.fill();
      }
      trail = trail.filter(function (p) { return p.life > 0; });
      if (trail.length) tRAF = requestAnimationFrame(trailLoop);
      else { tRAF = 0; tCtx.clearRect(0, 0, innerWidth, innerHeight); }
    }
  }

  /* --------------------------------- celebrate obvious success moments */
  new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      if (m.type !== 'attributes' && m.type !== 'childList') return;
      var t = m.target;
      if (t.classList && t.classList.contains('success-msg')) {
        var vis = getComputedStyle(t).display !== 'none' && (t.textContent || '').trim();
        if (vis && !t.dataset.celebrated) {
          t.dataset.celebrated = '1';
          CTFX.confetti({ count: 70 });
          CTFX.haptic([15, 35, 15]);
        }
      }
    });
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] });

})();
