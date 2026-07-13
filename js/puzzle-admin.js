// ═══════════════════════════════════════════════════════════
// 🧩 اللغز — puzzle-admin.js (نسخة التيمات المتعددة)
// ═══════════════════════════════════════════════════════════

var _currentPuzzleId = null;
var _puzzleMembers   = [];   // كل الأعضاء

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

// ── جلب الأعضاء وبناء القائمة ──
async function loadPuzzleMembersSelect() {
  var pass = sessionStorage.getItem('adminPass');
  if (!pass) return;
  _puzzleMembers = [];
  var res = await supabase.rpc('admin_list_members', { p_password: pass });
  if (res.error || !res.data) return;
  _puzzleMembers = res.data;
  renderPuzCheckList(_puzzleMembers);
}

// كل عضو فيه راديو: A أو B أو مش في التيم ده
function renderPuzCheckList(members) {
  var list = document.getElementById('puzCheckList');
  if (!list) return;
  if (!members.length) {
    list.innerHTML = '<p style="font-size:12px;color:var(--mist-dim);text-align:center;padding:12px 0">مفيش شباب</p>';
    return;
  }
  list.innerHTML = members.map(function(m) {
    return '<div style="display:flex;align-items:center;gap:8px;padding:7px 6px;border-radius:6px;border:1px solid transparent;transition:.15s" ' +
      'onmouseover="this.style.background=\'var(--ink-3)\'" onmouseout="this.style.background=\'\'">' +
      '<span style="font-size:13px;color:var(--mist);flex:1">' + esc(m.name) + '</span>' +
      // راديو A
      '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:12px;color:var(--gold);white-space:nowrap">' +
        '<input type="radio" name="puz_slot_' + m.id + '" value="A" class="puz-radio" data-member="' + m.id + '" ' +
          'onchange="updatePuzCount()" style="accent-color:var(--gold);cursor:pointer"> A' +
      '</label>' +
      // راديو B
      '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:12px;color:#a9e6c4;white-space:nowrap">' +
        '<input type="radio" name="puz_slot_' + m.id + '" value="B" class="puz-radio" data-member="' + m.id + '" ' +
          'onchange="updatePuzCount()" style="accent-color:#a9e6c4;cursor:pointer"> B' +
      '</label>' +
      // راديو بدون (إلغاء)
      '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:12px;color:var(--mist-dim);white-space:nowrap">' +
        '<input type="radio" name="puz_slot_' + m.id + '" value="" class="puz-radio" data-member="' + m.id + '" ' +
          'checked onchange="updatePuzCount()" style="cursor:pointer"> ✕' +
      '</label>' +
      '</div>';
  }).join('');
  updatePuzCount();
}

function filterPuzMembers() {
  var q = (document.getElementById('puzMemberSearch').value || '').trim().toLowerCase();
  var filtered = q ? _puzzleMembers.filter(function(m){ return m.name.toLowerCase().includes(q); }) : _puzzleMembers;
  renderPuzCheckList(filtered);
}

function updatePuzCount() {
  var a = document.querySelectorAll('.puz-radio[value="A"]:checked').length;
  var b = document.querySelectorAll('.puz-radio[value="B"]:checked').length;
  var el = document.getElementById('puzSelectedCount');
  if (el) el.textContent = 'A: ' + a + ' | B: ' + b;
}

function selectAllPuzMembers() {
  // مش منطقي هنا لأن كل واحد لازم يختار A أو B
  // بس ممكن نعمل "تحديد الكل A" لو حبوا
}

function deselectAllPuzMembers() {
  document.querySelectorAll('.puz-radio[value=""]').forEach(function(r){ r.checked = true; });
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
      p_image_url: null,
      p_hint:      hint,
      p_starts_at: startV ? new Date(startV).toISOString() : null,
      p_ends_at:   endV   ? new Date(endV).toISOString()   : null
    });
    if (res.error) throw res.error;
    _currentPuzzleId = res.data;
    msg.innerHTML = '✅ اتعمل اللغز! — دلوقتي أضف التيمات';
    document.getElementById('puzParticipantsCard').style.display = '';
    document.getElementById('puzStatusCard').style.display = '';
    await loadPuzzleMembersSelect();
    loadCurrentParticipants();
  } catch(e) {
    msg.textContent = '❌ ' + (e.message || 'حصل خطأ');
  }
  btn.disabled = false; btn.textContent = '🚀 ابدأ اللغز';
}

// ── إضافة تيم كامل للغز ──
async function addTeamToPuzzle() {
  var pass    = sessionStorage.getItem('adminPass');
  var msg     = document.getElementById('puzAddMsg');
  var teamName = document.getElementById('puzTeamName').value.trim();
  var imgA    = document.getElementById('puzTeamImgA').value.trim() || null;
  var imgB    = document.getElementById('puzTeamImgB').value.trim() || null;

  if (!_currentPuzzleId) { msg.textContent = '❌ ابدأ لغز الأول'; return; }
  if (!teamName)         { msg.textContent = '❌ اكتب اسم التيم'; return; }

  // اجمع A و B
  var membersA = Array.from(document.querySelectorAll('.puz-radio[value="A"]:checked')).map(function(r){ return r.dataset.member; });
  var membersB = Array.from(document.querySelectorAll('.puz-radio[value="B"]:checked')).map(function(r){ return r.dataset.member; });

  if (!membersA.length && !membersB.length) {
    msg.textContent = '❌ اختار أعضاء التيم وحدد A أو B لكل واحد'; return;
  }

  msg.textContent = '⏳ جاري الإضافة…';
  var errors = 0, added = 0;

  for (var i = 0; i < membersA.length; i++) {
    var r = await supabase.rpc('admin_add_puzzle_participant', {
      p_password:  pass,
      p_puzzle_id: _currentPuzzleId,
      p_member_id: membersA[i],
      p_image_url: imgA,
      p_team_name: teamName
    });
    if (r.error) errors++; else added++;
  }

  for (var j = 0; j < membersB.length; j++) {
    var rB = await supabase.rpc('admin_add_puzzle_participant', {
      p_password:  pass,
      p_puzzle_id: _currentPuzzleId,
      p_member_id: membersB[j],
      p_image_url: imgB,
      p_team_name: teamName
    });
    if (rB.error) errors++; else added++;
  }

  if (errors === 0) {
    msg.innerHTML = '✅ ' + teamName + ' اتضاف — A: ' + membersA.length + ' | B: ' + membersB.length;
    // reset فورم التيم
    document.getElementById('puzTeamName').value  = '';
    document.getElementById('puzTeamImgA').value  = '';
    document.getElementById('puzTeamImgB').value  = '';
    deselectAllPuzMembers();
  } else {
    msg.innerHTML = '⚠️ اتضاف ' + added + ' وفيه ' + errors + ' خطأ';
  }

  loadCurrentParticipants();
  loadPuzzleStatus();
}

// ── عرض التيمات المضافة ──
async function loadCurrentParticipants() {
  if (!_currentPuzzleId) return;
  var res = await supabase
    .from('puzzle_participants')
    .select('member_id, image_url, team_name, members(name)')
    .eq('puzzle_id', _currentPuzzleId)
    .order('team_name', { ascending: true });
  if (res.error || !res.data) return;

  var list = document.getElementById('puzParticipantsList');
  if (!res.data.length) {
    list.innerHTML = '<p style="font-size:12px;color:var(--mist-dim)">لسه مفيش تيمات</p>';
    return;
  }

  // نجمّع حسب team_name
  var teams = {};
  res.data.forEach(function(p) {
    var t = p.team_name || '(بدون تيم)';
    if (!teams[t]) teams[t] = { imgA: null, imgB: null, membersA: [], membersB: [] };
    var name = (p.members && p.members.name) || '—';
    // نعرف صورة A هي الأولى اللي اتسجلت
    if (!teams[t].imgA && p.image_url) teams[t].imgA = p.image_url;
    if (p.image_url === teams[t].imgA) teams[t].membersA.push(name);
    else teams[t].membersB.push(name);
    if (p.image_url && p.image_url !== teams[t].imgA) teams[t].imgB = p.image_url;
  });

  var totalCount = res.data.length;
  var html = '<p style="font-size:12px;color:var(--mist-dim);margin-bottom:10px">التيمات المضافة (' + Object.keys(teams).length + ' تيم — ' + totalCount + ' شخص):</p>';

  Object.keys(teams).forEach(function(tName) {
    var t = teams[tName];
    html += '<div style="border:1px solid var(--line);border-radius:8px;padding:12px;margin-bottom:10px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
        '<span style="font-size:13px;font-weight:700;color:var(--mist)">🏆 ' + esc(tName) + '</span>' +
        '<span style="font-size:11px;color:var(--mist-dim)">' + (t.membersA.length + t.membersB.length) + ' عضو</span>' +
      '</div>' +
      '<div style="display:flex;gap:10px">' +
        '<div style="flex:1;background:rgba(200,150,90,0.07);border-radius:6px;padding:8px">' +
          '<p style="font-size:11px;color:var(--gold);font-weight:700;margin:0 0 6px">📍 صورة A (' + t.membersA.length + ')</p>' +
          t.membersA.map(function(n){ return '<div style="font-size:12px;color:var(--mist);padding:2px 0">' + esc(n) + '</div>'; }).join('') +
        '</div>' +
        '<div style="flex:1;background:rgba(74,124,111,0.07);border-radius:6px;padding:8px">' +
          '<p style="font-size:11px;color:#a9e6c4;font-weight:700;margin:0 0 6px">📍 صورة B (' + t.membersB.length + ')</p>' +
          t.membersB.map(function(n){ return '<div style="font-size:12px;color:var(--mist);padding:2px 0">' + esc(n) + '</div>'; }).join('') +
        '</div>' +
      '</div>' +
    '</div>';
  });

  list.innerHTML = html;
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
      '<td style="text-align:center;padding:8px 4px;font-size:12px;color:var(--mist-dim)">' + esc(r.team_name || '—') + '</td>' +
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
