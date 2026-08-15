/* ==========================================================================
   CONNECT THREE — shared experience layer
   Loaded on every page. Injects its own DOM, so the 25 HTML files only need
   two <script> tags and nothing else.

   Design notes:
   - This is a multi-page app, so the full loader runs on the FIRST visit only
     (sessionStorage flag). Later navigations get a fast curtain wipe instead,
     which is why moving between pages doesn't feel like rebooting the app.
   - All 3D shares ONE WebGL context, drawn per-element with scissor rects.
     Five separate contexts would be five times the cost for no benefit.
   - Motion is CSS-driven where it must never stall (intro, reveals); GSAP
     handles scroll-linked work only.
   ========================================================================== */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE    = window.matchMedia('(pointer: fine)').matches;
  var G       = window.CT_GFX || null;             // set by vendor bundle
  var hasGL   = !!G && !REDUCED && supportsWebGL();

  function supportsWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }

  function el(tag, id, cls) {
    var n = document.createElement(tag);
    if (id) n.id = id;
    if (cls) n.className = cls;
    return n;
  }

  /* ---------------------------------------------------------------- DOM  */
  var curtain = el('div', 'ct-curtain');
  var prog    = el('div', 'ct-prog');
  document.body.appendChild(curtain);
  document.body.appendChild(prog);

  var isFirstVisit = !sessionStorage.getItem('ct_seen');
  var loader = null;
  if (isFirstVisit) {
    loader = el('div', 'ct-loader');
    loader.innerHTML =
      '<div class="n">0</div>' +
      '<div class="bar"><i></i></div>' +
      '<div class="t">CONNECT THREE</div>';
    document.body.appendChild(loader);
  }

  if (FINE && !REDUCED) {
    document.body.classList.add('ct-cursor');
    document.body.appendChild(el('div', 'ct-ring'));
    document.body.appendChild(el('div', 'ct-dot'));
  }

  /* --------------------------------------------------------- topbar utils */
  var topbar = document.querySelector('.topbar');
  if (topbar) {
    var utils = el('div', null, 'ct-utils');
    var tBtn = document.createElement('button');
    tBtn.type = 'button';
    tBtn.className = 'ct-theme';
    tBtn.setAttribute('aria-label', 'تبديل الوضع الليلي والنهاري');
    var sBtn = document.createElement('button');
    sBtn.type = 'button';
    sBtn.className = 'ct-sound';
    sBtn.setAttribute('aria-label', 'تشغيل وإيقاف الصوت');
    utils.appendChild(tBtn);
    utils.appendChild(sBtn);

    // sit next to the logout link if there is one, else at the end
    var logout = topbar.querySelector('.logout-link');
    if (logout && logout.parentNode === topbar) topbar.insertBefore(utils, logout);
    else topbar.appendChild(utils);

    var savedTheme = localStorage.getItem('ct_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    tBtn.textContent = savedTheme === 'dark' ? 'THEME[A]' : 'THEME[B]';
    tBtn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('ct_theme', next);
      tBtn.textContent = next === 'dark' ? 'THEME[A]' : 'THEME[B]';
      if (window.__ctSetTheme) window.__ctSetTheme(next);
      blip(620);
    });

    var soundOn = false, actx = null;
    sBtn.textContent = 'SOUND[·]';
    sBtn.addEventListener('click', function () {
      soundOn = !soundOn;
      sBtn.textContent = soundOn ? 'SOUND[♪]' : 'SOUND[·]';
      if (soundOn) blip(700);
    });
    window.__ctBlip = blip;
    function blip(freq, dur, vol) {
      if (!soundOn) return;
      try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine'; o.frequency.value = freq || 520;
        g.gain.setValueAtTime(vol || 0.045, actx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + (dur || 0.05));
        o.connect(g).connect(actx.destination);
        o.start(); o.stop(actx.currentTime + (dur || 0.05));
      } catch (e) { /* audio unavailable — not worth breaking the page over */ }
    }
  } else {
    var savedT = localStorage.getItem('ct_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedT);
  }

  /* -------------------------------------------------------------- cursor */
  if (FINE && !REDUCED) {
    var dot = document.getElementById('ct-dot');
    var ring = document.getElementById('ct-ring');
    var rx = 0, ry = 0, tx = 0, ty = 0;
    window.addEventListener('mousemove', function (e) {
      tx = e.clientX; ty = e.clientY;
      dot.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
    }, { passive: true });
    (function ring_loop() {
      rx += (tx - rx) * 0.16; ry += (ty - ry) * 0.16;
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px)';
      requestAnimationFrame(ring_loop);
    })();
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest('a,button,.gate,.tab,.step-btn,input,select,textarea,.copy-cell')) {
        ring.classList.add('big');
      }
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest('a,button,.gate,.tab,.step-btn,input,select,textarea,.copy-cell')) {
        ring.classList.remove('big');
      }
    });
  }

  /* ------------------------------------------------------ reveal targets */
  var revealSel = '.card, .gate, .material-item, .submission-item, .scoreboard, .lock-banner, table, .empty-state';
  var revealEls = [].slice.call(document.querySelectorAll(revealSel))
    // closest() matches the node itself, so check the PARENT chain — otherwise
    // every .gate excludes itself and nothing on the dashboard ever animates.
    .filter(function (n) {
      return !(n.parentElement && n.parentElement.closest('.gate'));
    });
  if (!REDUCED) revealEls.forEach(function (n) { n.classList.add('ct-rv'); });

  function revealAll() {
    document.querySelectorAll('.ct-rv').forEach(function (n) { n.classList.add('in'); });
  }

  function runReveals() {
    document.body.classList.add('ct-ready');
    if (REDUCED || !('IntersectionObserver' in window)) { revealAll(); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var i = revealEls.indexOf(en.target);
        en.target.style.transitionDelay = Math.min(Math.max(i, 0), 6) * 0.05 + 's';
        en.target.classList.add('in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (n) { io.observe(n); });

    /* Most of these pages render their cards only after Supabase returns.
       Anything added later gets picked up here so it animates too. */
    var mo = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        [].slice.call(m.addedNodes).forEach(function (n) {
          if (n.nodeType !== 1) return;
          var list = n.matches && n.matches(revealSel) ? [n] : [];
          if (n.querySelectorAll) {
            list = list.concat([].slice.call(n.querySelectorAll(revealSel)));
          }
          list.forEach(function (x) {
            if (x.classList.contains('ct-rv')) return;
            if (x.parentElement && x.parentElement.closest('.gate')) return;
            x.classList.add('ct-rv');
            revealEls.push(x);
            io.observe(x);
          });
        });
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    /* FAILSAFE — the animation layer must never be able to leave real content
       invisible. Anything on screen and still hidden after a beat is shown,
       and after 8s everything is shown no matter what. */
    setInterval(function () {
      var H = window.innerHeight;
      document.querySelectorAll('.ct-rv:not(.in)').forEach(function (n) {
        var r = n.getBoundingClientRect();
        if (r.top < H && r.bottom > 0) n.classList.add('in');
      });
    }, 1200);
    setTimeout(revealAll, 8000);
  }

  /* ------------------------------------------------ scroll progress bar */
  (function () {
    function upd() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      prog.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
    }
    window.addEventListener('scroll', upd, { passive: true });
    window.addEventListener('resize', upd);
    upd();
  })();

  /* ------------------------------------------- count-up for score digits */
  function countUp(node, to, ms) {
    var from = 0, t0 = performance.now();
    (function step(now) {
      var p = Math.min(1, (now - t0) / ms);
      var e = 1 - Math.pow(1 - p, 3);
      node.textContent = Math.round(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step);
      else node.textContent = to;
    })(t0);
  }
  window.ctCountUp = countUp;

  // Animate any score digit that already holds a number when the page settles.
  function animateScores() {
    if (REDUCED) return;
    document.querySelectorAll('.score-digit').forEach(function (n) {
      var v = parseInt((n.textContent || '').trim(), 10);
      if (!isNaN(v) && v > 0) { n.textContent = '0'; countUp(n, v, 900); }
    });
  }

  /* --------------------------------------------- page-transition curtain */
  function leaveTo(href) {
    try { sessionStorage.setItem('ct_nav', '1'); } catch (e) {}
    curtain.classList.add('in');
    var went = false;
    var go = function () { if (!went) { went = true; location.href = href; } };
    setTimeout(go, 420);
    // safety: if navigation is blocked for any reason, don't leave the
    // curtain sitting over the page
    setTimeout(function () {
      if (document.visibilityState === 'visible') curtain.classList.remove('in');
    }, 2500);
  }

  if (!REDUCED) {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || a.target === '_blank') return;
      if (/^(https?:|mailto:|tel:)/i.test(href) && a.host !== location.host) return;
      e.preventDefault();
      leaveTo(href);
    });

    // .gate uses onclick="location.href=..." — wrap it so those wipe too.
    document.querySelectorAll('.gate[onclick]').forEach(function (g) {
      var raw = g.getAttribute('onclick');
      var m = raw && raw.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
      if (!m) return;
      g.removeAttribute('onclick');
      g.addEventListener('click', function () {
        if (window.__ctBlip) window.__ctBlip(480, 0.06);
        leaveTo(m[1]);
      });
    });
  }

  /* ------------------------------------------------------------ 3D layer */
  var setThemeGL = null;
  if (hasGL) {
    try { setThemeGL = initGL(); } catch (err) { hasGL = false; }
  }
  window.__ctSetTheme = function (t) { if (setThemeGL) setThemeGL(t); };
  // apply the saved theme to the 3D layer on load, not only on toggle
  if (setThemeGL) setThemeGL(document.documentElement.getAttribute('data-theme') || 'dark');

  function initGL() {
    var THREE = G.THREE;
    var canvas = el('canvas', 'ct-gl');
    document.body.appendChild(canvas);

    var renderer = new THREE.WebGLRenderer({
      canvas: canvas, antialias: true, alpha: true, premultipliedAlpha: false
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setScissorTest(true);

    function size() {
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
    }
    size();

    var pmrem = new THREE.PMREMGenerator(renderer);
    var env = pmrem.fromScene(new G.RoomEnvironment(), 0.04).texture;

    var GOLD = 0xD4A257, CORAL = 0xD25F42;

    function glassMat(tint, opacity) {
      return new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(tint), metalness: 0.35, roughness: 0.08,
        clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.7,
        transparent: true, opacity: opacity == null ? 0.6 : opacity,
        depthWrite: false
      });
    }

    var slots = [];
    function addSlot(node, scene, cam, update) {
      if (!node) return;
      var rec = { el: node, scene: scene, camera: cam, update: update, vis: true };
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { rec.vis = e.isIntersecting; });
      }, { threshold: 0 }).observe(node);
      slots.push(rec);
    }

    function lit(scene, tint) {
      scene.environment = env;
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      var a = new THREE.PointLight(0xffffff, 2.0); a.position.set(5, 5, 6); scene.add(a);
      var b = new THREE.PointLight(tint, 1.3); b.position.set(-5, -3, 4); scene.add(b);
      return scene;
    }

    /* --- ambient backdrop: present on every page, fixed behind content --- */
    var bg = el('div', 'ct-bg');
    bg.style.cssText = 'position:fixed;inset:0;pointer-events:none;';
    document.body.appendChild(bg);

    var bgScene = lit(new THREE.Scene(), GOLD);
    var bgCam = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    bgCam.position.set(0, 0, 12);
    var bgGroup = new THREE.Group();
    [[1.5, -2.6, 1.4, -2], [1.15, 2.9, -1.6, -1], [0.9, 0.4, 2.4, -3]]
      .forEach(function (s) {
        var m = new THREE.Mesh(new THREE.IcosahedronGeometry(s[0], 1), glassMat(GOLD, 0.11));
        m.position.set(s[1], s[2], s[3]);
        bgGroup.add(m);
      });
    bgScene.add(bgGroup);
    var mx = 0, my = 0, cmx = 0, cmy = 0;
    window.addEventListener('mousemove', function (e) {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });
    addSlot(bg, bgScene, bgCam, function () {
      cmx += (mx - cmx) * 0.04; cmy += (my - cmy) * 0.04;
      bgGroup.rotation.y = cmx * 0.5 + performance.now() * 0.00005;
      bgGroup.rotation.x = cmy * 0.3;
    });

    /* --- hero on the login screen --- */
    var logo = document.querySelector('.login-logo-img');
    if (logo) {
      // Wrap just the logo so the 3D halo is centred on it and never spills
      // over the wordmark underneath.
      var holder = el('div', 'ct-logo-holder');
      holder.style.cssText = 'position:relative;width:140px;height:140px;margin:0 auto 16px;';
      logo.parentNode.insertBefore(holder, logo);
      holder.appendChild(logo);
      logo.style.margin = '0';

      var stage = el('div', 'ct-hero');
      stage.style.cssText = 'position:absolute;left:50%;top:50%;width:300px;height:300px;transform:translate(-50%,-50%);pointer-events:none;';
      holder.insertBefore(stage, holder.firstChild);

      var hs = lit(new THREE.Scene(), GOLD);
      var hc = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      hc.position.set(0, 0, 9);
      var hg = new THREE.Group();
      [[1.25, -1.1, 0.2, 0, GOLD], [0.95, 0.9, -0.4, 0.4, CORAL], [0.7, 0.1, 1.0, -0.4, GOLD]]
        .forEach(function (s) {
          var m = new THREE.Mesh(new THREE.SphereGeometry(s[0], 40, 40), glassMat(s[4], 0.34));
          m.position.set(s[1], s[2], s[3]);
          hg.add(m);
        });
      var ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.1, 0.035, 12, 90),
        new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.5 })
      );
      ring.rotation.x = 1.15;
      hg.add(ring);
      hs.add(hg);
      addSlot(stage, hs, hc, function () {
        hg.rotation.y += 0.0035;
        hg.rotation.x = Math.sin(performance.now() * 0.0003) * 0.18;
      });
    }

    /* --- ornament beside the topbar brand --- */
    var brand = document.querySelector('.topbar .brand');
    if (brand) {
      var orn = el('span', null, 'ct-orn');
      brand.appendChild(orn);
      var os = lit(new THREE.Scene(), GOLD);
      var oc = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
      oc.position.set(0, 0, 4);
      var om = new THREE.Mesh(new THREE.TorusKnotGeometry(0.78, 0.26, 90, 14), glassMat(GOLD, 0.75));
      os.add(om);
      addSlot(orn, os, oc, function () { om.rotation.x += 0.008; om.rotation.y += 0.012; });
    }

    /* --- ornament behind each score digit --- */
    document.querySelectorAll('.score-digit').forEach(function (d, i) {
      var host = el('span');
      host.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
      d.style.position = 'relative';
      d.appendChild(host);
      var ss = lit(new THREE.Scene(), i === 0 ? GOLD : CORAL);
      var sc = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
      sc.position.set(0, 0, 5);
      var sm = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.15, 0),
        glassMat(i === 0 ? GOLD : CORAL, 0.28)
      );
      ss.add(sm);
      addSlot(host, ss, sc, function () { sm.rotation.x += 0.005; sm.rotation.y += 0.007; });
    });

    /* --- render all visible slots through one context --- */
    function renderSlots() {
      var H = window.innerHeight;
      for (var i = 0; i < slots.length; i++) {
        var s = slots[i];
        if (!s.vis) continue;
        var r = s.el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > H) continue;
        var bottom = H - r.bottom;
        renderer.setViewport(r.left, bottom, r.width, r.height);
        renderer.setScissor(r.left, bottom, r.width, r.height);
        s.camera.aspect = r.width / r.height;
        s.camera.updateProjectionMatrix();
        if (s.update) s.update();
        renderer.render(s.scene, s.camera);
      }
    }

    (function warm() {
      renderer.setViewport(0, 0, 64, 64);
      renderer.setScissor(0, 0, 64, 64);
      slots.forEach(function (s) { renderer.render(s.scene, s.camera); });
      renderer.clear();
    })();

    (function loop() {
      requestAnimationFrame(loop);
      renderer.clear();
      renderSlots();
    })();

    window.addEventListener('resize', size);

    /* Adaptive quality: measure real frame rate and shed work if the device
       can't hold it — conference phones vary wildly.
       Append ?gfx=high to any page URL to bypass this while testing. */
    var forceHigh = /[?&]gfx=high/.test(location.search);
    if (!forceHigh) setTimeout(function () {
      var f = 0, t0 = performance.now();
      (function c() {
        f++;
        var dt = performance.now() - t0;
        if (dt < 1500) return requestAnimationFrame(c);
        var fps = f / (dt / 1000);
        if (fps < 32) renderer.setPixelRatio(1);
        if (fps < 18) {
          // keep only the ambient backdrop
          slots = slots.filter(function (s) { return s.el === bg; });
        }
        if (fps < 10) {
          slots.length = 0;
          canvas.style.display = 'none';
        }
        document.documentElement.dataset.gfx =
          fps < 18 ? 'low' : (fps < 32 ? 'mid' : 'high');
      })();
    }, 2200);

    return function (theme) {
      // Glass reflections need something dark to read against. On the cream
      // theme the ambient shapes turn into grey smudges no matter how faint,
      // so they're retired there — the logo halo and the ornaments still
      // carry the 3D. Zero size means renderSlots() skips the slot entirely.
      var light = theme === 'light';
      bg.style.display = light ? 'none' : '';
      bgGroup.children.forEach(function (m) {
        m.material.opacity = 0.11;
        m.material.needsUpdate = true;
      });
    };
  }

  /* ------------------------------------------------------------- sequence */
  function finish() {
    runReveals();
    animateScores();
  }

  if (isFirstVisit && loader) {
    sessionStorage.setItem('ct_seen', '1');
    var n = loader.querySelector('.n');
    var bar = loader.querySelector('.bar i');
    var DUR = 1500, t0 = performance.now();
    (function step() {
      var p = Math.min(1, (performance.now() - t0) / DUR);
      var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      n.textContent = Math.round(e * 100);
      bar.style.width = (e * 100) + '%';
      if (p < 1) requestAnimationFrame(step);
      else {
        loader.classList.add('gone');
        setTimeout(function () { loader.style.display = 'none'; }, 460);
        setTimeout(finish, 300);
      }
    })();
  } else {
    // Only wipe if we actually arrived from an in-app navigation. A direct
    // load or refresh should never be covered by a curtain.
    if (sessionStorage.getItem('ct_nav')) {
      sessionStorage.removeItem('ct_nav');
      // cover instantly (no transition), then wipe away and switch the
      // element off for good — it can never end up stuck over the page.
      curtain.style.transition = 'none';
      curtain.style.transform = 'translateY(0)';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          curtain.style.transition = '';
          curtain.style.transform = 'translateY(-100%)';
          setTimeout(function () { curtain.style.display = 'none'; }, 620);
        });
      });
      // Frame-independent safety. On a very slow device rAF can crawl, and a
      // curtain left covering the screen would make the app look broken.
      setTimeout(function () { curtain.style.display = 'none'; }, 1400);
    } else {
      curtain.style.display = 'none';
    }
    setTimeout(finish, 120);
  }

  // If the page is restored from bfcache the curtain must not stay down.
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) curtain.classList.remove('in', 'out');
  });
})();
