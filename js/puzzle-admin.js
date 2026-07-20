// ═══════════════════════════════════════════════════════════
// 🧩 اللغز — puzzle-admin.js (نسخة 4 صور: أ ب ت ث)
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
  renderTeamQuickSelect(_puzzleMembers);
  renderPuzCheckList(_puzzleMembers);
}

// ── بناء أزرار الاختيار السريع للتيمات ──
function renderTeamQuickSelect(members) {
  var box = document.getElementById('puzTeamQuickSelect');
  if (!box) return;

  // جمّع التيمات الفريدة
  var teams = {};
  members.forEach(function(m) {
    var t = m.team_name || '';
    if (t && !teams[t]) teams[t] = [];
    if (t) teams[t].push(m.id);
  });

  var teamNames = Object.keys(teams);
  if (!teamNames.length) {
    box.innerHTML = '<p style="font-size:12px;color:var(--mist-dim)">مفيش تيمات محددة في النظام</p>';
    return;
  }

  var slotLabels = ['أ', 'ب', 'ت', 'ث'];
  var slotValues = ['A', 'B', 'C', 'D'];
  var slotColors = ['var(--gold)', '#a9e6c4', '#a9c4e6', '#e6a9c4'];

  var html = '<p style="font-size:12px;color:var(--mist-dim);margin-bottom:8px">اختار تيم كامل مرة واحدة وحدد ليه Slot:</p>';
  html += '<div style="display:flex;flex-direction:column;gap:6px">';

  teamNames.forEach(function(tName) {
    var count = teams[tName].length;
    html += '<div style="display:flex;align-items:center;gap:6px;padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:var(--ink-3)">' +
      '<span style="font-size:13px;color:var(--mist);flex:1">🏆 ' + esc(tName) + ' <span style="font-size:11px;color:var(--mist-dim)">(' + count + ' عضو)</span></span>' +
      slotLabels.map(function(label, i) {
        return '<button onclick="assignTeamToSlot(' + JSON.stringify(tName) + ',\'' + slotValues[i] + '\')" ' +
          'style="padding:4px 10px;border-radius:20px;border:1px solid ' + slotColors[i] + ';background:transparent;color:' + slotColors[i] + ';font-size:12px;cursor:pointer;font-weight:700" ' +
          'title="حدد كل ' + esc(tName) + ' في slot ' + label + '">' + label + '</button>';
      }).join('') +
      '<button onclick="clearTeamSlot(' + JSON.stringify(tName) + ')" ' +
        'style="padding:4px 10px;border-radius:20px;border:1px solid var(--mist-dim);background:transparent;color:var(--mist-dim);font-size:12px;cursor:pointer" ' +
        'title="إلغاء تحديد كل ' + esc(tName) + '">✕</button>' +
    '</div>';
  });

  html += '</div>';
  box.innerHTML = html;
}

// ── تعيين تيم كامل لـ slot معين ──
function assignTeamToSlot(teamName, slot) {
  _puzzleMembers.forEach(function(m) {
    if ((m.team_name || '') === teamName) {
      var radio = document.querySelector('.puz-radio[value="' + slot + '"][data-member="' + m.id + '"]');
      if (radio) radio.checked = true;
    }
  });
  updatePuzCount();
}

// ── إلغاء تحديد تيم كامل ──
function clearTeamSlot(teamName) {
  _puzzleMembers.forEach(function(m) {
    if ((m.team_name || '') === teamName) {
      var radio = document.querySelector('.puz-radio[value=""][data-member="' + m.id + '"]');
      if (radio) radio.checked = true;
    }
  });
  updatePuzCount();
}

// كل عضو فيه راديو: أ أو ب أو ت أو ث أو مش في التيم
function renderPuzCheckList(members) {
  var list = document.getElementById('puzCheckList');
  if (!list) return;
  if (!members.length) {
    list.innerHTML = '<p style="font-size:12px;color:var(--mist-dim);text-align:center;padding:12px 0">مفيش شباب</p>';
    return;
  }
  list.innerHTML = members.map(function(m) {
    return '<div style="display:flex;align-items:center;gap:6px;padding:7px 6px;border-radius:6px;border:1px solid transparent;transition:.15s" ' +
      'onmouseover="this.style.background=\'var(--ink-3)\'" onmouseout="this.style.background=\'\'">' +
      '<span style="font-size:13px;color:var(--mist);flex:1">' + esc(m.name) + '</span>' +
      // راديو أ
      '<label style="display:flex;align-items:center;gap:3px;cursor:pointer;font-size:12px;color:var(--gold);white-space:nowrap">' +
        '<input type="radio" name="puz_slot_' + m.id + '" value="A" class="puz-radio" data-member="' + m.id + '" ' +
          'onchange="updatePuzCount()" style="accent-color:var(--gold);cursor:pointer"> أ' +
      '</label>' +
      // راديو ب
      '<label style="display:flex;align-items:center;gap:3px;cursor:pointer;font-size:12px;color:#a9e6c4;white-space:nowrap">' +
        '<input type="radio" name="puz_slot_' + m.id + '" value="B" class="puz-radio" data-member="' + m.id + '" ' +
          'onchange="updatePuzCount()" style="accent-color:#a9e6c4;cursor:pointer"> ب' +
      '</label>' +
      // راديو ت
      '<label style="display:flex;align-items:center;gap:3px;cursor:pointer;font-size:12px;color:#a9c4e6;white-space:nowrap">' +
        '<input type="radio" name="puz_slot_' + m.id + '" value="C" class="puz-radio" data-member="' + m.id + '" ' +
          'onchange="updatePuzCount()" style="accent-color:#a9c4e6;cursor:pointer"> ت' +
      '</label>' +
      // راديو ث
      '<label style="display:flex;align-items:center;gap:3px;cursor:pointer;font-size:12px;color:#e6a9c4;white-space:nowrap">' +
        '<input type="radio" name="puz_slot_' + m.id + '" value="D" class="puz-radio" data-member="' + m.id + '" ' +
          'onchange="updatePuzCount()" style="accent-color:#e6a9c4;cursor:pointer"> ث' +
      '</label>' +
      // راديو بدون (إلغاء)
      '<label style="display:flex;align-items:center;gap:3px;cursor:pointer;font-size:12px;color:var(--mist-dim);white-space:nowrap">' +
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
  var c = document.querySelectorAll('.puz-radio[value="C"]:checked').length;
  var d = document.querySelectorAll('.puz-radio[value="D"]:checked').length;
  var el = document.getElementById('puzSelectedCount');
  if (el) el.textContent = 'أ:' + a + ' | ب:' + b + ' | ت:' + c + ' | ث:' + d;
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

// ── إضافة تيم كامل للغز (4 صور: أ ب ت ث) ──
async function addTeamToPuzzle() {
  var pass     = sessionStorage.getItem('adminPass');
  var msg      = document.getElementById('puzAddMsg');
  var teamName = document.getElementById('puzTeamName').value.trim();
  var imgA     = document.getElementById('puzTeamImgA').value.trim() || null;
  var imgB     = document.getElementById('puzTeamImgB').value.trim() || null;
  var imgC     = document.getElementById('puzTeamImgC').value.trim() || null;
  var imgD     = document.getElementById('puzTeamImgD').value.trim() || null;

  if (!_currentPuzzleId) { msg.textContent = '❌ ابدأ لغز الأول'; return; }
  if (!teamName)         { msg.textContent = '❌ اكتب اسم التيم'; return; }

  // اجمع الأربع مجموعات
  var membersA = Array.from(document.querySelectorAll('.puz-radio[value="A"]:checked')).map(function(r){ return r.dataset.member; });
  var membersB = Array.from(document.querySelectorAll('.puz-radio[value="B"]:checked')).map(function(r){ return r.dataset.member; });
  var membersC = Array.from(document.querySelectorAll('.puz-radio[value="C"]:checked')).map(function(r){ return r.dataset.member; });
  var membersD = Array.from(document.querySelectorAll('.puz-radio[value="D"]:checked')).map(function(r){ return r.dataset.member; });

  if (!membersA.length && !membersB.length && !membersC.length && !membersD.length) {
    msg.textContent = '❌ اختار أعضاء التيم وحدد أ أو ب أو ت أو ث لكل واحد'; return;
  }

  msg.textContent = '⏳ جاري الإضافة…';
  var errors = 0, added = 0;

  // إضافة كل مجموعة بصورتها
  var groups = [
    { members: membersA, img: imgA },
    { members: membersB, img: imgB },
    { members: membersC, img: imgC },
    { members: membersD, img: imgD }
  ];

  for (var g = 0; g < groups.length; g++) {
    var group = groups[g];
    for (var i = 0; i < group.members.length; i++) {
      var r = await supabase.rpc('admin_add_puzzle_participant', {
        p_password:  pass,
        p_puzzle_id: _currentPuzzleId,
        p_member_id: group.members[i],
        p_image_url: group.img,
        p_team_name: teamName
      });
      if (r.error) errors++; else added++;
    }
  }

  if (errors === 0) {
    msg.innerHTML = '✅ ' + teamName + ' اتضاف — أ:' + membersA.length + ' | ب:' + membersB.length + ' | ت:' + membersC.length + ' | ث:' + membersD.length;
    // reset فورم التيم
    document.getElementById('puzTeamName').value  = '';
    document.getElementById('puzTeamImgA').value  = '';
    document.getElementById('puzTeamImgB').value  = '';
    document.getElementById('puzTeamImgC').value  = '';
    document.getElementById('puzTeamImgD').value  = '';
    deselectAllPuzMembers();
  } else {
    msg.innerHTML = '⚠️ اتضاف ' + added + ' وفيه ' + errors + ' خطأ';
  }

  loadCurrentParticipants();
  loadPuzzleStatus();
}

// ── عرض التيمات المضافة (4 صور) ──
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

  // نجمّع حسب team_name، وداخل كل تيم نجمّع حسب image_url
  var teams = {};
  res.data.forEach(function(p) {
    var t = p.team_name || '(بدون تيم)';
    if (!teams[t]) teams[t] = { images: [], members: {} };
    var name = (p.members && p.members.name) || '—';
    var img  = p.image_url || '__none__';
    if (!teams[t].members[img]) {
      teams[t].images.push(img);
      teams[t].members[img] = [];
    }
    teams[t].members[img].push(name);
  });

  var slotLabels = ['أ', 'ب', 'ت', 'ث', 'ج', 'ح'];
  var slotColors = ['var(--gold)', '#a9e6c4', '#a9c4e6', '#e6a9c4', '#e6d5a9', '#c4a9e6'];

  var totalCount = res.data.length;
  var html = '<p style="font-size:12px;color:var(--mist-dim);margin-bottom:10px">التيمات المضافة (' + Object.keys(teams).length + ' تيم — ' + totalCount + ' شخص):</p>';

  Object.keys(teams).forEach(function(tName) {
    var t = teams[tName];
    var totalInTeam = Object.values(t.members).reduce(function(s,arr){ return s+arr.length; }, 0);

    html += '<div style="border:1px solid var(--line);border-radius:8px;padding:12px;margin-bottom:10px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
        '<span style="font-size:13px;font-weight:700;color:var(--mist)">🏆 ' + esc(tName) + '</span>' +
        '<span style="font-size:11px;color:var(--mist-dim)">' + totalInTeam + ' عضو</span>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';

    t.images.forEach(function(img, idx) {
      var label = slotLabels[idx] || ('صورة ' + (idx+1));
      var color = slotColors[idx] || 'var(--mist)';
      var membersInGroup = t.members[img] || [];
      html += '<div style="background:rgba(255,255,255,0.03);border-radius:6px;padding:8px">' +
        '<p style="font-size:11px;font-weight:700;margin:0 0 6px;color:' + color + '">📍 صورة ' + label + ' (' + membersInGroup.length + ')</p>' +
        membersInGroup.map(function(n){ return '<div style="font-size:12px;color:var(--mist);padding:2px 0">' + esc(n) + '</div>'; }).join('') +
      '</div>';
    });

    html += '</div></div>';
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
