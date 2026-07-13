// ============================================================
// badges.js — نظام الـ Badges لـ Connect Three
// ضيفه في js/badges.js
// ============================================================
// الاستخدام من أي صفحة:
//   await Badges.award('puzzle_done');          ← يمنح badge + يعمل أنيميشن
//   await Badges.renderShelf('containerId');    ← يعرض قائمة badges في عنصر
// ============================================================

var Badges = (function () {

  // ── تعريف الـ badges محلياً (عشان نعرض اللي مش اتكسبت بالرمادي) ──
  var ALL_BADGES = [
    { id: 'first_login',      emoji: '🌅', name: 'أول خطوة'    },
    { id: 'puzzle_done',      emoji: '🧩', name: 'حلّال ألغاز'  },
    { id: 'wheel_spun',       emoji: '🎡', name: 'حظ جميل'     },
    { id: 'daily_q_answered', emoji: '❓', name: 'فضولي'       },
    { id: 'team_challenge',   emoji: '👥', name: 'لاعب فريق'   },
    { id: 'secret_sent',      emoji: '📩', name: 'صاحب سر'     },
    { id: 'gratitude_posted', emoji: '🙏', name: 'ممتنّ'       },
    { id: 'prediction_made',  emoji: '🔮', name: 'نبيّ'        }
  ];

  // ── مساعد: ضمان وجود الـ toast container ──
  function _ensureContainer() {
    var wrap = document.getElementById('bdg-toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'bdg-toast-wrap';
      document.body.appendChild(wrap);
    }
    return wrap;
  }

  // ── نجوم burst حول الـ emoji ──
  function _burstStars(anchorEl) {
    if (!anchorEl) return;
    var rect = anchorEl.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top  + rect.height / 2;
    var stars = ['✦', '✧', '★', '✦', '✧'];
    stars.forEach(function (s, i) {
      var el = document.createElement('span');
      el.className = 'bdg-star';
      el.textContent = s;
      var angle = (i / stars.length) * 2 * Math.PI;
      var dist = 38 + Math.random() * 22;
      el.style.left = (cx + Math.cos(angle) * dist - 9) + 'px';
      el.style.top  = (cy + Math.sin(angle) * dist - 9) + 'px';
      el.style.animationDelay = (i * 0.07) + 's';
      document.body.appendChild(el);
      setTimeout(function () { el.remove(); }, 900);
    });
  }

  // ── confetti ──
  function _confetti(anchorEl) {
    if (!anchorEl) return;
    var rect = anchorEl.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top;
    var colors = ['#C8975A', '#C0533A', '#4A7C6F', '#E8E0D0', '#a07840'];
    for (var i = 0; i < 14; i++) {
      (function (i) {
        var el = document.createElement('div');
        el.className = 'bdg-confetti';
        el.style.background = colors[i % colors.length];
        el.style.left = (cx + (Math.random() - 0.5) * 100) + 'px';
        el.style.top  = cy + 'px';
        el.style.animationDelay = (i * 0.045) + 's';
        el.style.animationDuration = (0.7 + Math.random() * 0.4) + 's';
        el.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
        document.body.appendChild(el);
        setTimeout(function () { el.remove(); }, 1400);
      })(i);
    }
  }

  // ── أنيميشن عداد النقاط في الداشبورد ──
  function _animatePoints(newVal) {
    var el = document.getElementById('pointsVal');
    if (!el) return;
    var oldVal = parseInt(el.textContent) || 0;
    if (newVal <= oldVal) return;
    el.classList.add('pts-animating');
    var start = oldVal;
    var diff  = newVal - oldVal;
    var duration = 600;
    var startTime = null;
    function step(ts) {
      if (!startTime) startTime = ts;
      var progress = Math.min((ts - startTime) / duration, 1);
      var ease = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(start + diff * ease);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = newVal;
        setTimeout(function () { el.classList.remove('pts-animating'); }, 300);
      }
    }
    requestAnimationFrame(step);
  }

  // ── عرض الـ toast ──
  function _showToast(data) {
    var wrap = _ensureContainer();

    var toast = document.createElement('div');
    toast.className = 'bdg-toast';
    toast.innerHTML =
      '<div class="bdg-emoji-wrap" id="bdg-anim-anchor">' + data.badge_emoji + '</div>' +
      '<div class="bdg-text">' +
        '<div class="bdg-label">🏅 إنجاز جديد!</div>' +
        '<div class="bdg-name">' + data.badge_name + '</div>' +
        '<div class="bdg-desc">' + data.description + '</div>' +
      '</div>' +
      (data.points > 0
        ? '<div class="bdg-pts">' +
            '<div class="bdg-pts-num">+' + data.points + '</div>' +
            '<div class="bdg-pts-label">نقطة</div>' +
          '</div>'
        : '');

    // إغلاق بالضغط
    toast.addEventListener('click', function () { _dismissToast(toast); });

    wrap.appendChild(toast);

    // أنيميشن النجوم والكونفيتي بعد ظهور الـ toast
    setTimeout(function () {
      var anchor = toast.querySelector('#bdg-anim-anchor');
      _burstStars(anchor);
      _confetti(anchor);
    }, 200);

    // اختفاء تلقائي بعد 4.5 ثانية
    setTimeout(function () { _dismissToast(toast); }, 4500);
  }

  function _dismissToast(toast) {
    if (toast._leaving) return;
    toast._leaving = true;
    toast.classList.add('leaving');
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 320);
  }

  // ── منح badge: اتصل بـ Supabase ثم أظهر الأنيميشن ──
  async function award(badgeId) {
    var member = (typeof getSession === 'function') ? getSession() : null;
    if (!member) return null;

    try {
      var res = await supabase.rpc('award_badge', {
        p_member_id: member.id,
        p_badge_id:  badgeId
      });

      if (res.error) {
        console.warn('[Badges] RPC error:', res.error);
        return null;
      }

      var data = res.data;
      if (!data || !data.awarded) return null;

      // أظهر الـ toast
      _showToast(data);

      // حدّث العداد في الداشبورد لو موجود
      if (data.points > 0) {
        var el = document.getElementById('pointsVal');
        if (el) {
          var cur = parseInt(el.textContent) || 0;
          _animatePoints(cur + data.points);
        }
      }

      return data;
    } catch (e) {
      console.warn('[Badges] award error:', e);
      return null;
    }
  }

  // ── رسم قائمة الـ badges في عنصر HTML ──
  async function renderShelf(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var member = (typeof getSession === 'function') ? getSession() : null;
    if (!member) return;

    try {
      var res = await supabase.rpc('get_my_badges', { p_member_id: member.id });
      var earnedIds = {};
      if (!res.error && res.data) {
        res.data.forEach(function (b) { earnedIds[b.badge_id] = true; });
      }

      var total = Object.keys(earnedIds).length;

      var earnedList  = ALL_BADGES.filter(function(b){ return !!earnedIds[b.id]; });
      var lockedList  = ALL_BADGES.filter(function(b){ return !earnedIds[b.id]; });

      function earnedRow(b, i){
        return '<div style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:14px;background:linear-gradient(135deg,rgba(200,150,90,0.13),rgba(192,83,58,0.07));border:1px solid rgba(200,150,90,0.3);margin-bottom:8px;animation:bdg-pop .4s cubic-bezier(0.34,1.56,0.64,1) ' + (i*0.07) + 's both">'
             + '<div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,rgba(200,150,90,0.2),rgba(192,83,58,0.12));border:1px solid rgba(200,150,90,0.35);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;box-shadow:0 0 12px rgba(200,150,90,0.2)">' + b.emoji + '</div>'
             + '<div style="flex:1">'
             + '<div style="font-family:\'Changa\',\'Tajawal\',sans-serif;font-weight:800;font-size:13px;color:#E8E0D0">' + b.name + '</div>'
             + '</div>'
             + '<div style="font-size:18px">✅</div>'
             + '</div>';
      }

      function lockedRows(list){
        if(!list.length) return '';
        return '<div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:4px">'
             + list.map(function(b){
                 return '<div title="' + b.name + '" style="display:flex;align-items:center;gap:6px;padding:5px 10px 5px 6px;border-radius:99px;border:1px solid rgba(255,255,255,0.07);background:rgba(6,15,24,0.35)">'
                      + '<span style="font-size:15px;filter:grayscale(1) opacity(0.3)">' + b.emoji + '</span>'
                      + '<span style="font-size:11px;color:#50483a;font-family:\'Tajawal\',sans-serif">' + b.name + '</span>'
                      + '</div>';
               }).join('')
             + '</div>';
      }

      container.innerHTML =
        '<div style="background:linear-gradient(160deg,#152235,#1C2E45);border:1px solid rgba(200,160,100,0.15);border-radius:18px;padding:18px 20px">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">'
        +   '<span style="font-family:\'Changa\',\'Tajawal\',sans-serif;font-weight:800;font-size:14px;color:#E8E0D0">🏅 إنجازاتي</span>'
        +   '<span style="font-size:11px;color:#C8975A;background:rgba(200,150,90,0.1);border:1px solid rgba(200,150,90,0.2);border-radius:99px;padding:2px 10px;font-family:\'Changa\',sans-serif;font-weight:700">' + total + ' / ' + ALL_BADGES.length + '</span>'
        + '</div>'
        + (earnedList.length ? earnedList.map(function(b,i){ return earnedRow(b,i); }).join('') : '')
        + (lockedList.length ? '<div style="margin-top:' + (earnedList.length ? '10px' : '0') + ';padding-top:' + (earnedList.length ? '10px' : '0') + ';border-top:' + (earnedList.length ? '1px solid rgba(255,255,255,0.05)' : 'none') + '">'
            + '<div style="font-size:11px;color:#50483a;font-family:\'Tajawal\',sans-serif;margin-bottom:8px">لسه مكسبتهاش</div>'
            + lockedRows(lockedList)
            + '</div>' : '')
        + '</div>';
    } catch (e) {
      console.warn('[Badges] renderShelf error:', e);
    }
  }

  // ── التحقق التلقائي من first_login ──
  async function checkFirstLogin() {
    var member = (typeof getSession === 'function') ? getSession() : null;
    if (!member) return;

    // هل سبق وظهر الـ badge في هذا الجهاز؟
    var key = 'bdg_fl_' + member.id;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');

    // منح الـ badge
    await award('first_login');
  }

  // ── Public API ──
  return {
    award:           award,
    renderShelf:     renderShelf,
    checkFirstLogin: checkFirstLogin,
    animatePoints:   _animatePoints
  };

})();

// ── تشغيل first_login تلقائياً عند تحميل الملف ──
(function () {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      Badges.checkFirstLogin();
    });
  } else {
    Badges.checkFirstLogin();
  }
})();
