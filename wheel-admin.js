// ═══════════════════════════════════════════════════════════
// 🎡 عجلة الجوائز — wheel-admin.js
// ═══════════════════════════════════════════════════════════

var _wheelActive = true;
var _wheelSpins  = [];

// ── مراقبة تاب العجلة ──
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      if (this.dataset.tab === 'wheel') {
        setTimeout(function(){
          loadWheelActiveState();
          loadWheelSpins();
        }, 150);
      }
    });
  });
});

// ── حالة التشغيل ──
async function loadWheelActiveState() {
  var pass = sessionStorage.getItem('adminPass');
  if (!pass) return;
  var res = await supabase.rpc('admin_get_wheel_active', { p_password: pass });
  if (!res.error && typeof res.data === 'boolean') {
    _wheelActive = res.data;
  }
  renderWheelToggleBtn();
}

function renderWheelToggleBtn() {
  var btn = document.getElementById('wheelToggleBtn');
  if (!btn) return;
  btn.textContent = _wheelActive ? '⏸️ قفل العجلة' : '▶️ فتح العجلة';
  btn.style.background = _wheelActive ? 'var(--coral)' : 'var(--pitch)';
  btn.style.borderColor = _wheelActive ? 'var(--coral)' : 'var(--pitch)';
}

async function toggleWheelActive() {
  var pass = sessionStorage.getItem('adminPass');
  if (!pass) return;
  _wheelActive = !_wheelActive;
  var res = await supabase.rpc('admin_set_wheel_active', { p_password: pass, p_active: _wheelActive });
  if (res.error) {
    alert('خطأ: ' + res.error.message);
    _wheelActive = !_wheelActive;
    return;
  }
  renderWheelToggleBtn();
}

// ── تحميل اللفّات ──
async function loadWheelSpins() {
  var pass = sessionStorage.getItem('adminPass');
  if (!pass) return;
  var body = document.getElementById('wheelTableBody');
  if (body) body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--mist-dim)">⏳ بنحمّل...</td></tr>';

  var res = await supabase.rpc('admin_list_wheel_spins', { p_password: pass });
  if (res.error || !res.data) {
    if (body) body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--coral)">حصل خطأ</td></tr>';
    return;
  }
  _wheelSpins = res.data;

  var countEl = document.getElementById('wheelCount');
  if (countEl) countEl.textContent = _wheelSpins.length;

  renderWheelStats();
  renderWheelTable();
}

function renderWheelStats() {
  var box = document.getElementById('wheelStats');
  if (!box) return;
  var counts = {};
  _wheelSpins.forEach(function(s) {
    counts[s.prize_label] = (counts[s.prize_label] || 0) + 1;
  });
  var keys = Object.keys(counts);
  if (!keys.length) {
    box.innerHTML = '<span style="font-size:12px;color:var(--mist-dim)">لسه محدش لف</span>';
    return;
  }
  box.innerHTML = keys.map(function(k) {
    return '<div style="background:var(--ink-3);border:1px solid var(--line);border-radius:99px;padding:6px 14px;font-size:12px;color:var(--mist)">' +
      escHtml(k) + ' <strong style="color:var(--gold)">' + counts[k] + '</strong>' +
    '</div>';
  }).join('');
}

function renderWheelTable() {
  var body = document.getElementById('wheelTableBody');
  if (!body) return;
  if (!_wheelSpins.length) {
    body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--mist-dim)">لسه محدش لف العجلة</td></tr>';
    return;
  }
  body.innerHTML = _wheelSpins.map(function(s) {
    var d = new Date(s.spun_at);
    var t = d.toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    return '<tr>' +
      '<td>' + escHtml(s.member_name) + '</td>' +
      '<td>' + escHtml(s.team_name || '—') + '</td>' +
      '<td>' + escHtml(s.prize_label) + (s.points_won > 0 ? ' <small style="color:var(--gold)">(+' + s.points_won + ')</small>' : '') + '</td>' +
      '<td style="font-size:12px;color:var(--mist-dim)">' + t + '</td>' +
      '<td class="no-print"><button onclick="resetMemberWheel(\'' + s.member_id + '\',\'' + escHtml(s.member_name).replace(/'/g,"") + '\')" ' +
        'style="background:none;border:1px solid rgba(192,83,58,0.3);color:var(--coral);padding:4px 10px;border-radius:99px;cursor:pointer;font-size:11px">🔄 لف تاني</button></td>' +
    '</tr>';
  }).join('');
}

async function resetMemberWheel(memberId, memberName) {
  if (!confirm('تسمح لـ ' + memberName + ' يلف العجلة تاني؟ (النقاط اللي أخدها مش هتتسحب)')) return;
  var pass = sessionStorage.getItem('adminPass');
  if (!pass) return;
  var res = await supabase.rpc('admin_reset_member_wheel', { p_password: pass, p_member_id: memberId });
  if (res.error) { alert('خطأ: ' + res.error.message); return; }
  loadWheelSpins();
}

async function resetWheelAll() {
  if (!confirm('متأكد إنك عايز تصفّر لفّات كل الشباب؟ هيقدروا يلفوا تاني من الأول (النقاط مش هتتسحب)')) return;
  var pass = sessionStorage.getItem('adminPass');
  if (!pass) return;
  var res = await supabase.rpc('admin_reset_wheel_all', { p_password: pass });
  if (res.error) { alert('خطأ: ' + res.error.message); return; }
  loadWheelSpins();
}

function escHtml(s) {
  return (s || '').toString().replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
