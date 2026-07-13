// ═══════════════════════════════════════════════════════════
// 🧩 اللغز — puzzle-admin.js (نسخة الفرقتين A/B)
// ═══════════════════════════════════════════════════════════

var _currentPuzzleId = null;
var _puzzleMembers   = [];          // كل الأعضاء
var _activePuzTab    = 'A';         // التاب الحالي

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

// ── تبديل تاب الفريق ──
function switchPuzTab(team) {
  _activePuzTab = team;
  document.getElementById('puzTabA').style.display = team === 'A' ? '' : 'none';
  document.getElementById('puzTabB').style.display = team === 'B' ? '' : 'none';

  var btnA = document.getElementById('puzTabBtnA');
  var btnB = document.getElementById('puzTabBtnB');
  if (team === 'A') {
    btnA.style.cssText = 'flex:1;background:rgba(200,150,90,0.2);border-color:var(--gold);color:var(--gold)';
    btnB.style.cssText = 'flex:1';
    btnB.className = 'btn small outline';
  } else {
    btnB.style.cssText = 'flex:1;background:rgba(74,124,111,0.2);border-color:#a9e6c4;color:#a9e6c4';
    btnA.style.cssText = 'flex:1';
    btnA.className = 'btn small outline';
  }
}

// ── جلب الأعضاء وبناء القوائم ──
async function loadPuzzleMembersSelect() {
  var pass = sessionStorage.getItem('adminPass');
  if (!pass) return;
  _puzzleMembers = [];
  var res = await supabase.rpc('admin_list_members', { p_password: pass });
  if (res.error || !res.data) return;
  _puzzleMembers = res.data;
  renderPuzTeamList('A', _puzzleMembers);
  renderPuzTeamList('B', _puzzleMembers);
}

// ── بناء قائمة فريق واحد ──
function renderPuzTeamList(team, members) {
  var listId = 'puzList' + team;
  var list = document.getElementById(listId);
  if (!list) return;

  if (!members.length) {
    list.innerHTML = '<p style="font-size:12px;color:var(--mist-dim);text-align:center;padding:12px 0">مفيش شباب</p>';
    return;
  }

  var colorTeam = team === 'A' ? 'var(--gold)' : '#a9e6c4';
  list.innerHTML = members.map(function(m) {
    return '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px 6px;border-radius:6px;border:1px solid transparent" ' +
      'onmouseover="this.style.background=\'var(--ink-3)\'" onmouseout="this.style.background=\'\'">' +
      '<input type="checkbox" value="' + m.id + '" class="puz-chk-' + team + '" ' +
        'onchange="updatePuzCountTeam(\'' + team + '\')" ' +
        'style="width:18px;height:18px;flex-shrink:0;cursor:pointer;accent-color:' + colorTeam + '">' +
      '<span style="font-size:13px;color:var(--mist)">' + esc(m.name) + '</span>' +
      '</label>';
  }).join('');
  updatePuzCountTeam(team);
}

// ── فلترة بحث لكل فريق ──
function filterPuzTeam(team) {
  var searchId = 'puzSearch' + team;
  var q = (document.getElementById(searchId).value || '').trim().toLowerCase();
  var filtered = q ? _puzzleMembers.filter(function(m){ return m.name.toLowerCase().includes(q); }) : _puzzleMembers;
  renderPuzTeamList(team, filtered);
}

// ── تحديث عداد كل فريق ──
function updatePuzCountTeam(team) {
  var checked = document.querySelectorAll('.puz-chk-' + team + ':checked').length;
  var el = document.getElementById('puzCount' + team);
  if (el) el.textContent = checked + ' محدود';
}

function selectAllPuzTeam(team) {
  document.querySelectorAll('.puz-chk-' + team).forEach(function(c){ c.checked = true; });
  updatePuzCountTeam(team);
}

function deselectAllPuzTeam(team) {
  document.querySelectorAll('.puz-chk-' + team).forEach(function(c){ c.checked = false; });
  updatePuzCountTeam(team);
}

// ── للتوافق مع الكود القديم (لو في مكان بيستدعيها) ──
function updatePuzCount() {
  updatePuzCountTeam('A');
  updatePuzCountTeam('B');
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
  var imgA   = document.getElementById('puzImgA').value.trim() || null;
  var imgB   = document.getElementById('puzImgB').value.trim() || null;
  var hint   = document.getElementById('puzHint').value.trim() || null;
  var startV = document.getElementById('puzStart').value;
  var endV   = document.getElementById('puzEnd').value;

  if (!pass) { msg.textContent = '❌ ادخل باسورد الأدمن الأول'; return; }
  btn.disabled = true; btn.textContent = '⏳ جاري الإنشاء…';
  msg.textContent = '';

  // نحتاج نحفظ الصورتين — نبعت imgA كـ image_url افتراضي للجدول
  // وnull هيتعامل معاها بالفرقة لما نضيف المشتركين
  try {
    var res = await supabase.rpc('admin_create_puzzle', {
      p_password:  pass,
      p_title:     title,
      p_image_url: imgA,   // الصورة الافتراضية هي A
      p_hint:      hint,
      p_starts_at: startV ? new Date(startV).toISOString() : null,
      p_ends_at:   endV   ? new Date(endV).toISOString()   : null
    });
    if (res.error) throw res.error;
    _currentPuzzleId = res.data;

    // نحفظ الصورتين في sessionStorage لاستخدامها وقت إضافة المشتركين
    sessionStorage.setItem('puzImgA_' + _currentPuzzleId, imgA || '');
    sessionStorage.setItem('puzImgB_' + _currentPuzzleId, imgB || '');

    msg.innerHTML = '✅ اتعمل اللغز! — دلوقتي اختار فرقة A وفرقة B وضيفهم';
    document.getElementById('puzParticipantsCard').style.display = '';
    document.getElementById('puzStatusCard').style.display = '';
    await loadPuzzleMembersSelect();
    loadCurrentParticipants();
  } catch(e) {
    msg.textContent = '❌ ' + (e.message || 'حصل خطأ');
  }
  btn.disabled = false; btn.textContent = '🚀 ابدأ اللغز';
}

// ── إضافة المشتركين بالفرقتين ──
async function addParticipantsBulk() {
  var pass  = sessionStorage.getItem('adminPass');
  var msg   = document.getElementById('puzAddMsg');

  if (!_currentPuzzleId) { msg.textContent = '❌ ابدأ لغز الأول'; return; }

  var checkedA = Array.from(document.querySelectorAll('.puz-chk-A:checked')).map(function(c){ return c.value; });
  var checkedB = Array.from(document.querySelectorAll('.puz-chk-B:checked')).map(function(c){ return c.value; });

  if (!checkedA.length && !checkedB.length) {
    msg.textContent = '❌ اختار شخص واحد على الأقل في أي فرقة'; return;
  }

  // اجلب الصورتين من sessionStorage أو من المدخلات
  var imgA = sessionStorage.getItem('puzImgA_' + _currentPuzzleId)
          || document.getElementById('puzImgA').value.trim()
          || null;
  var imgB = sessionStorage.getItem('puzImgB_' + _currentPuzzleId)
          || document.getElementById('puzImgB').value.trim()
          || null;

  msg.textContent = '⏳ جاري الإضافة…';
  var errors = 0;
  var added  = 0;

  // إضافة فرقة A
  for (var i = 0; i < checkedA.length; i++) {
    var res = await supabase.rpc('admin_add_puzzle_participant', {
      p_password:  pass,
      p_puzzle_id: _currentPuzzleId,
      p_member_id: checkedA[i],
      p_image_url: imgA
    });
    if (res.error) errors++;
    else added++;
  }

  // إضافة فرقة B
  for (var j = 0; j < checkedB.length; j++) {
    var resB = await supabase.rpc('admin_add_puzzle_participant', {
      p_password:  pass,
      p_puzzle_id: _currentPuzzleId,
      p_member_id: checkedB[j],
      p_image_url: imgB
    });
    if (resB.error) errors++;
    else added++;
  }

  if (errors === 0) {
    msg.innerHTML = '✅ اتضافوا كلهم — فرقة A: ' + checkedA.length + ' | فرقة B: ' + checkedB.length;
  } else {
    msg.innerHTML = '⚠️ اتضاف ' + added + ' وفيه ' + errors + ' خطأ';
  }

  deselectAllPuzTeam('A');
  deselectAllPuzTeam('B');
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

  // نجمّع الأعضاء حسب الصورة (A أو B)
  var imgA = sessionStorage.getItem('puzImgA_' + _currentPuzzleId) || '';
  var imgB = sessionStorage.getItem('puzImgB_' + _currentPuzzleId) || '';
  var teamA = [], teamB = [], noTeam = [];

  res.data.forEach(function(p) {
    var name = (p.members && p.members.name) || '—';
    if (p.image_url && p.image_url === imgA) teamA.push(name);
    else if (p.image_url && p.image_url === imgB) teamB.push(name);
    else noTeam.push(name);
  });

  function teamBlock(label, color, names) {
    if (!names.length) return '';
    return '<div style="margin-bottom:10px">' +
      '<p style="font-size:11px;font-weight:700;color:' + color + ';margin-bottom:6px">' + label + ' (' + names.length + ')</p>' +
      names.map(function(n) {
        return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--line)">' +
          '<div style="width:24px;height:24px;background:var(--ink-3);border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">📍</div>' +
          '<span style="font-size:13px;color:var(--mist)">' + esc(n) + '</span>' +
          '</div>';
      }).join('') +
    '</div>';
  }

  list.innerHTML =
    '<p style="font-size:12px;color:var(--mist-dim);margin-bottom:10px">المشتركين (' + res.data.length + '):</p>' +
    teamBlock('📍 فرقة A', 'var(--gold)', teamA) +
    teamBlock('📍 فرقة B', '#a9e6c4', teamB) +
    teamBlock('بدون فريق', 'var(--mist-dim)', noTeam);
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
