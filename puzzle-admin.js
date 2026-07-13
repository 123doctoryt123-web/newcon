// ═══════════════════════════════════════════════════════════
// 🧩 اللغز — puzzle-admin.js
// ═══════════════════════════════════════════════════════════

var _currentPuzzleId = null;
var _puzzleMembers   = [];

// ── مراقبة تاب اللغز ──
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      if (this.dataset.tab === 'puzzle') {
        setTimeout(loadActivePuzzle, 200);
      }
    });
  });
});

// ── جلب كل الشباب وبناء الـ checkboxes ──
async function loadPuzzleMembersSelect() {
  var pass = sessionStorage.getItem('adminPass');
  if (!pass) return;
  _puzzleMembers = [];
  var res = await supabase.rpc('admin_list_members', { p_password: pass });
  if (res.error || !res.data) return;
  _puzzleMembers = res.data;
  renderPuzCheckList(_puzzleMembers);
}

function renderPuzCheckList(members) {
  var list = document.getElementById('puzCheckList');
  if (!list) return;
  if (!members.length) {
    list.innerHTML = '<p style="font-size:12px;color:var(--mist-dim);text-align:center;padding:12px 0">مفيش شباب</p>';
    return;
  }
  list.innerHTML = members.map(function(m) {
    return '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px 6px;border-radius:6px;border:1px solid transparent" ' +
      'onmouseover="this.style.background=\'var(--ink-3)\'" onmouseout="this.style.background=\'\'">' +
      '<input type="checkbox" value="' + m.id + '" class="puz-chk" onchange="updatePuzCount()" ' +
      'style="width:18px;height:18px;flex-shrink:0;cursor:pointer">' +
      '<span style="font-size:13px;color:var(--mist)">' + esc(m.name) + '</span>' +
      '</label>';
  }).join('');
  updatePuzCount();
}

function filterPuzMembers() {
  var q = (document.getElementById('puzMemberSearch').value || '').trim().toLowerCase();
  var filtered = q ? _puzzleMembers.filter(function(m){ return m.name.toLowerCase().includes(q); }) : _puzzleMembers;
  renderPuzCheckList(filtered);
}

function updatePuzCount() {
  var checked = document.querySelectorAll('.puz-chk:checked').length;
  var el = document.getElementById('puzSelectedCount');
  if (el) el.textContent = checked + ' محدود';
}

function selectAllPuzMembers() {
  document.querySelectorAll('.puz-chk').forEach(function(c){ c.checked = true; });
  updatePuzCount();
}

function deselectAllPuzMembers() {
  document.querySelectorAll('.puz-chk').forEach(function(c){ c.checked = false; });
  updatePuzCount();
}

// ── جلب اللغز النشط ──
async function loadActivePuzzle() {
  var pass = sessionStorage.getItem('adminPass');
  if (!pass) return;
  var res = await supabase
    .from('puzzles')
    .select('id, title, active')
    .eq('active', true)
    .maybeSingle();
  if (res.data) {
    _currentPuzzleId = res.data.id;
    document.getElementById('puzParticipantsCard').style.display = '';
    document.getElementById('puzStatusCard').style.display = '';
    await loadPuzzleMembersSelect();
    loadPuzzleStatus();
    loadCurrentParticipants();
  }
}

// ── إنشاء لغز جديد ──
async function createPuzzle() {
  var pass   = sessionStorage.getItem('adminPass');
  var msg    = document.getElementById('puzCreateMsg');
  var btn    = document.getElementById('createPuzBtn');
  var title  = document.getElementById('puzTitle').value.trim() || 'اللغز 🧩';
  var imgUrl = document.getElementById('puzImgUrl').value.trim() || null;
  var hint   = document.getElementById('puzHint').value.trim() || null;
  var startV = document.getElementById('puzStart').value;
  var endV   = document.getElementById('puzEnd').value;

  if (!pass) { msg.textContent = '❌ ادخل باسورد الأدمن الأول'; return; }
  btn.disabled = true; btn.textContent = '⏳ جاري الإنشاء…';
  msg.textContent = '';

  try {
    var res = await supabase.rpc('admin_create_puzzle', {
      p_password:  pass,
      p_title:     title,
      p_image_url: imgUrl,
      p_hint:      hint,
      p_starts_at: startV ? new Date(startV).toISOString() : null,
      p_ends_at:   endV   ? new Date(endV).toISOString()   : null
    });
    if (res.error) throw res.error;
    _currentPuzzleId = res.data;
    msg.innerHTML = '✅ اتعمل اللغز!';
    document.getElementById('puzParticipantsCard').style.display = '';
    document.getElementById('puzStatusCard').style.display = '';
    await loadPuzzleMembersSelect();
    loadCurrentParticipants();
  } catch(e) {
    msg.textContent = '❌ ' + (e.message || 'حصل خطأ');
  }
  btn.disabled = false; btn.textContent = '🚀 ابدأ اللغز';
}

// ── إضافة مشتركين دفعة واحدة ──
async function addParticipantsBulk() {
  var pass    = sessionStorage.getItem('adminPass');
  var msg     = document.getElementById('puzAddMsg');
  var checked = Array.from(document.querySelectorAll('.puz-chk:checked')).map(function(c){ return c.value; });

  if (!_currentPuzzleId) { msg.textContent = '❌ ابدأ لغز الأول'; return; }
  if (!checked.length)   { msg.textContent = '❌ اختار شخص واحد على الأقل'; return; }

  msg.textContent = '⏳ جاري الإضافة…';
  var errors = 0;
  for (var i = 0; i < checked.length; i++) {
    var res = await supabase.rpc('admin_add_puzzle_participant', {
      p_password:  pass,
      p_puzzle_id: _currentPuzzleId,
      p_member_id: checked[i],
      p_image_url: null
    });
    if (res.error) errors++;
  }

  if (errors === 0) {
    msg.innerHTML = '✅ اتضافوا كلهم (' + checked.length + ' شخص)';
  } else {
    msg.innerHTML = '⚠️ اتضاف ' + (checked.length - errors) + ' وفيه ' + errors + ' خطأ';
  }
  deselectAllPuzMembers();
  loadCurrentParticipants();
  loadPuzzleStatus();
}

// ── عرض المشتركين الحاليين ──
async function loadCurrentParticipants() {
  if (!_currentPuzzleId) return;
  var res = await supabase
    .from('puzzle_participants')
    .select('member_id, image_url, members(name)')
    .eq('puzzle_id', _currentPuzzleId);
  if (res.error || !res.data) return;
  var list = document.getElementById('puzParticipantsList');
  if (!res.data.length) {
    list.innerHTML = '<p style="font-size:12px;color:var(--mist-dim)">لسه مفيش مشتركين</p>';
    return;
  }
  list.innerHTML = '<p style="font-size:12px;color:var(--mist-dim);margin-bottom:8px">المشتركين (' + res.data.length + '):</p>' +
    res.data.map(function(p) {
      return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line)">' +
        '<div style="width:28px;height:28px;background:var(--ink-3);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">📍</div>' +
        '<span style="font-size:13px;color:var(--mist)">' + esc((p.members && p.members.name) || '—') + '</span>' +
        '</div>';
    }).join('');
}

// ── حالة المشتركين ──
async function loadPuzzleStatus() {
  if (!_currentPuzzleId) return;
  var pass = sessionStorage.getItem('adminPass');
  if (!pass) return;
  var res = await supabase.rpc('admin_get_puzzle_status', {
    p_password:  pass,
    p_puzzle_id: _currentPuzzleId
  });
  if (res.error || !res.data) return;
  var data  = res.data;
  var done  = data.filter(function(r){ return r.completed; }).length;
  var total = data.length;

  document.getElementById('puzStatusSummary').innerHTML =
    '<div style="background:rgba(74,124,111,0.15);border:1px solid var(--pitch);border-radius:8px;padding:10px 16px;text-align:center">' +
      '<div style="font-size:22px;font-weight:800;color:#a9e6c4">' + done + '</div>' +
      '<div style="font-size:11px;color:var(--mist-dim)">وجبوا الورقة</div>' +
    '</div>' +
    '<div style="background:rgba(192,83,58,0.12);border:1px solid rgba(192,83,58,0.3);border-radius:8px;padding:10px 16px;text-align:center">' +
      '<div style="font-size:22px;font-weight:800;color:#ffb3a6">' + (total - done) + '</div>' +
      '<div style="font-size:11px;color:var(--mist-dim)">لسه</div>' +
    '</div>' +
    '<div style="background:var(--ink-3);border:1px solid var(--line);border-radius:8px;padding:10px 16px;text-align:center">' +
      '<div style="font-size:22px;font-weight:800;color:var(--mist)">' + total + '</div>' +
      '<div style="font-size:11px;color:var(--mist-dim)">إجمالي</div>' +
    '</div>';

  document.getElementById('puzStatusBody').innerHTML = data.map(function(r, i) {
    var timeStr = r.completed_at
      ? new Date(r.completed_at).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit', second:'2-digit'})
      : '—';
    return '<tr style="border-bottom:1px solid var(--line)">' +
      '<td style="padding:8px 4px"><span style="font-size:11px;color:var(--mist-dim);margin-left:4px">' + (i+1) + '</span>' + esc(r.member_name) + '</td>' +
      '<td style="text-align:center;padding:8px 4px">' +
        (r.completed ? '<span style="color:#a9e6c4;font-size:12px">✅ وجب</span>' : '<span style="color:var(--mist-dim);font-size:12px">⏳ لسه</span>') +
      '</td>' +
      '<td style="text-align:center;padding:8px 4px;font-size:12px;color:var(--mist-dim)">' + timeStr + '</td>' +
    '</tr>';
  }).join('');
}

// ── إيقاف اللغز ──
async function stopPuzzle() {
  if (!confirm('هتوقف اللغز؟')) return;
  var pass = sessionStorage.getItem('adminPass');
  var res  = await supabase.rpc('admin_stop_puzzle', { p_password: pass });
  if (res.error) { alert('حصل خطأ: ' + res.error.message); return; }
  _currentPuzzleId = null;
  document.getElementById('puzParticipantsCard').style.display = 'none';
  document.getElementById('puzStatusCard').style.display = 'none';
  document.getElementById('puzCreateMsg').textContent = '⏹ اتوقف اللغز';
}
