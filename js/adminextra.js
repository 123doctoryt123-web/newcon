// ============================================================
// adminextra.js — الفرق، البرنامج، الجاسوس، درس الكتاب
// ============================================================
// ============================================================
// القادة ومجموعات المشاريع
// ============================================================
var groupSelectedIds = new Set();
var leadersMembersCache = [];

document.addEventListener("DOMContentLoaded",function(){
  document.getElementById("saveTeamStatsBtn").addEventListener("click",saveMemberTeam);
  document.getElementById("teamMemberSelect").addEventListener("change",fillTeamInputsFromSelection);
  document.getElementById("addProgBtn").addEventListener("click",addProgramItem);
  document.getElementById("startSpyBtn").addEventListener("click",startSpyGame);
  document.getElementById("stopSpyBtn").addEventListener("click",stopSpyGame);
  document.getElementById("selectAllSpyBtn").addEventListener("click",function(){ teamsMembersCache.forEach(function(m){ spySelectedIds.add(m.id); }); renderSpyMembers(); });
  document.getElementById("deselectAllSpyBtn").addEventListener("click",function(){ spySelectedIds.clear(); renderSpyMembers(); });
  loadTeamsAdmin();
  loadProgramAdmin();

  // القادة والمشاريع — listeners بس، التحميل هيحصل لما التاب ينفتح
  var setLeaderBtn = document.getElementById('setLeaderBtn');
  if(setLeaderBtn) setLeaderBtn.addEventListener('click', setMemberRole);
  var createGroupBtn = document.getElementById('createGroupBtn');
  if(createGroupBtn) createGroupBtn.addEventListener('click', createProjectGroup);
});

// تحميل بيانات القادة لما تاب "teams" ينفتح (panel-leaders اتدمج فيه)
(function watchTeamsTab(){
  var panel = document.getElementById('panel-teams');
  if(!panel) return;
  var loaded = false;
  var observer = new MutationObserver(function(){
    if(panel.classList.contains('active') && !loaded){
      loaded = true;
      loadLeadersAdmin();
      loadProjectGroups();
    }
    if(!panel.classList.contains('active')) loaded = false;
  });
  observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
})();

function escHtml(s){
  return(s||"").toString().replace(/[&<>"']/g,function(c){
    return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  });
}

// ============================================================
// الفرق
// ============================================================
var teamsMembersCache=[];

async function loadTeamsAdmin(){
  var res=await supabase.rpc("admin_list_members_teams",{p_password:getAdminPass()});
  if(res.error) return;
  teamsMembersCache=res.data||[];
  // sync leadersMembersCache so group picker is always up to date
  leadersMembersCache=teamsMembersCache.slice();
  // keep hidden select in sync (used by spy game)
  var select=document.getElementById("teamMemberSelect");
  if(select){
    select.innerHTML=teamsMembersCache.map(function(m){
      return'<option value="'+m.id+'">'+escHtml(m.name)+'</option>';
    }).join("")||'<option value="">لسه مفيش شباب</option>';
  }
  renderTeamsTable();
  renderGroupFilterChips();
  renderSpyMembers();
}

function fillTeamInputsFromSelection(){
  // kept for backward compat — no-op when inputs are hidden
  var id=document.getElementById("teamMemberSelect").value;
  var m=teamsMembersCache.find(function(x){ return x.id===id; });
  var tn=document.getElementById("teamNameInput");
  var tp=document.getElementById("teamPointsInput");
  if(tn) tn.value=m?(m.team_name||""):"";
  if(tp) tp.value=m?(m.points||0):0;
}

function renderTeamsTable(){
  var tbody=document.getElementById("teamsTableBody");
  if(!tbody) return;
  var roleLabel={
    leader:'<span class="badge-leader">👑 قائد</span>',
    member:'<span style="color:var(--mist-dim);font-size:12px">عضو</span>'
  };
  tbody.innerHTML=teamsMembersCache.map(function(m){
    var teamCell = m.team_name
      ? '<span style="font-size:11px;background:rgba(200,150,90,.1);padding:2px 8px;border-radius:99px;color:var(--gold-dim)">'+escHtml(m.team_name)+'</span>'
      : '<span style="color:var(--coral);font-size:11px">⚠ بدون فريق</span>';
    return'<tr class="member-row-clickable" onclick="openMemberModal(\''+m.id+'\')">'+
      '<td style="font-weight:600">'+escHtml(m.name)+'</td>'+
      '<td>'+teamCell+'</td>'+
      '<td>'+(roleLabel[m.role]||roleLabel.member)+'</td>'+
      '<td style="font-family:var(--font-display);font-weight:700;color:var(--gold)">'+(m.points||0)+'</td>'+
      '</tr>';
  }).join("")||'<tr><td colspan="4" style="text-align:center;color:var(--mist-dim);padding:20px">لسه مفيش شباب مضافين</td></tr>';
}

async function saveMemberTeam(){
  // kept for backward compat (hidden button) — delegates to modal save
  openMemberModal(document.getElementById("teamMemberSelect").value);
}

// ============================================================
// البرنامج
// ============================================================
var dayNames={1:"اليوم الأول",2:"اليوم الثاني",3:"اليوم الثالث"};

async function addProgramItem(){
  var day=parseInt(document.getElementById("progDay").value);
  var time=document.getElementById("progTime").value.trim();
  var title=document.getElementById("progTitle").value.trim();
  var order=parseInt(document.getElementById("progOrder").value)||1;
  if(!time||!title) return;
  var btn=document.getElementById("addProgBtn");
  btn.disabled=true; btn.textContent="بنضيف...";
  var res=await supabase.rpc("admin_add_program_item",{p_password:getAdminPass(),p_day:day,p_time_label:time,p_title:title,p_sort_order:order});
  btn.disabled=false; btn.textContent="إضافة للبرنامج";
  if(res.error){ alert("حصل خطأ، حاول تاني"); return; }
  document.getElementById("progTime").value=""; document.getElementById("progTitle").value="";
  loadProgramAdmin();
}

async function loadProgramAdmin(){
  var res=await supabase.from("program_items").select("*").order("day").order("sort_order").order("time_label");
  var box=document.getElementById("programAdminList");
  var items=res.data||[];
  if(items.length===0){ box.innerHTML='<div class="empty-state">لسه مفيش برنامج</div>'; return; }
  var grouped={1:[],2:[],3:[]};
  items.forEach(function(i){ grouped[i.day].push(i); });
  var html="";
  [1,2,3].forEach(function(day){
    if(grouped[day].length===0) return;
    html+='<div style="margin-bottom:14px"><strong style="color:var(--gold)">'+dayNames[day]+'</strong>';
    grouped[day].forEach(function(item){
      html+='<div class="submission-item"><div><span style="color:var(--gold);font-weight:700">'+escHtml(item.time_label)+'</span> — '+escHtml(item.title)+'</div>'+
        '<button class="btn danger small" data-id="'+item.id+'">حذف</button></div>';
    });
    html+='</div>';
  });
  box.innerHTML=html;
  box.querySelectorAll("button[data-id]").forEach(function(btn){
    btn.addEventListener("click",async function(){
      await supabase.rpc("admin_delete_program_item",{p_password:getAdminPass(),p_id:btn.dataset.id});
      loadProgramAdmin();
    });
  });
}

// ============================================================
// الجاسوس
// ============================================================
var spySelectedIds=new Set();

function renderSpyMembers(){
  var box=document.getElementById("spyMembersList");
  if(!box) return;
  if(teamsMembersCache.length===0){ box.innerHTML='<span style="color:var(--mist-dim);font-size:13px">لسه مفيش شباب</span>'; return; }
  box.innerHTML=teamsMembersCache.map(function(m){
    var sel=spySelectedIds.has(m.id);
    return'<button class="btn small '+(sel?"":"outline")+' spy-member-btn" data-id="'+m.id+'" style="margin:2px">'+(sel?"✅ ":"")+escHtml(m.name)+'</button>';
  }).join("");
  box.querySelectorAll(".spy-member-btn").forEach(function(btn){
    btn.addEventListener("click",function(){
      var id=btn.dataset.id;
      if(spySelectedIds.has(id)) spySelectedIds.delete(id); else spySelectedIds.add(id);
      renderSpyMembers();
    });
  });
}

async function startSpyGame(){
  var word=document.getElementById("spyWord").value.trim();
  var count=parseInt(document.getElementById("spyCount").value)||1;
  var msg=document.getElementById("spyMsg");
  if(!word){ msg.innerHTML='<div class="error-msg" style="display:block">اكتب الكلمة السرية الأول</div>'; return; }
  var selectedArr=Array.from(spySelectedIds);
  if(selectedArr.length===0){ msg.innerHTML='<div class="error-msg" style="display:block">اختار اللاعبين الأول</div>'; return; }
  if(count>=selectedArr.length){ msg.innerHTML='<div class="error-msg" style="display:block">عدد الجواسيس أكبر من عدد اللاعبين!</div>'; return; }
  var btn=document.getElementById("startSpyBtn");
  btn.disabled=true; btn.textContent="بنبدأ...";
  var res=await supabase.rpc("admin_create_spy_game",{p_password:getAdminPass(),p_word:word,p_spy_count:count,p_member_ids:selectedArr});
  btn.disabled=false; btn.textContent="🎮 ابدأ لعبة جديدة";
  if(res.error){ msg.innerHTML='<div class="error-msg" style="display:block">حصل خطأ، حاول تاني</div>'; return; }
  msg.innerHTML='<div class="success-msg" style="display:block">✅ اللعبة بدأت! الكلمة: <strong>'+escHtml(word)+'</strong> — لاعبين: '+selectedArr.length+' — جواسيس: '+count+'</div>';
  document.getElementById("spyWord").value="";
  spySelectedIds.clear(); renderSpyMembers();
}

async function stopSpyGame(){
  var msg=document.getElementById("spyMsg");
  await supabase.rpc("admin_stop_spy_game",{p_password:getAdminPass()});
  msg.innerHTML='<div class="success-msg" style="display:block">⏹️ اللعبة اتوقفت</div>';
}

// ============================================================
// درس الكتاب — الأسئلة السرية
// ============================================================
function timeAgo(dateStr) {
  var diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return "منذ أقل من دقيقة";
  if (diff < 3600) return "منذ " + Math.floor(diff / 60) + " دقيقة";
  if (diff < 86400) return "منذ " + Math.floor(diff / 3600) + " ساعة";
  return "منذ " + Math.floor(diff / 86400) + " يوم";
}

async function loadBookQuestions() {
  var res = await supabase.rpc("admin_get_book_questions", { p_password: getAdminPass() });
  var el = document.getElementById("bookQList");
  if (!el) return;
  if (res.error || !res.data || !res.data.length) {
    el.innerHTML = '<div class="empty-state">مفيش أسئلة لسه</div>';
    return;
  }
  el.innerHTML = res.data.map(function(q, i) {
    return '<div style="padding:12px;border-bottom:1px solid var(--line);display:flex;gap:10px;align-items:flex-start">' +
      '<span style="color:var(--mist-dim);font-size:12px;min-width:20px">' + (i+1) + '</span>' +
      '<div style="flex:1">' +
        '<div style="color:var(--mist);font-size:14px">' + escHtml(q.question) + '</div>' +
        '<div style="color:var(--mist-dim);font-size:11px;margin-top:4px">' + timeAgo(q.created_at) + '</div>' +
      '</div>' +
      '<button onclick="deleteBookQ(' + q.id + ')" style="background:none;border:none;color:#c0533a;cursor:pointer;font-size:16px">✕</button>' +
    '</div>';
  }).join('');
}

async function deleteBookQ(id) {
  await supabase.rpc("admin_delete_book_question", { p_password: getAdminPass(), p_id: id });
  loadBookQuestions();
}

async function clearBookQuestions() {
  if (!confirm("هتمسح كل الأسئلة؟")) return;
  await supabase.rpc("admin_clear_book_questions", { p_password: getAdminPass() });
  loadBookQuestions();
}
// ============================================================
// القادة: تحميل وتعيين الأدوار
// ============================================================
async function loadLeadersAdmin(){
  var pass = getAdminPass();
  if(!pass){ console.warn('loadLeadersAdmin: no admin pass yet'); return; }

  // نجيب الشباب من admin_list_members (الموجودة دايماً) أو admin_list_members_teams
  var res = await supabase.rpc("admin_list_members_teams", {p_password: pass});

  // لو فشلت بسبب missing role column، نجرب admin_list_members كـ fallback
  if(res.error){
    console.warn('admin_list_members_teams error:', res.error.message);
    var fallback = await supabase.rpc("admin_list_members", {p_password: pass});
    if(fallback.error || !fallback.data){ 
      console.error('fallback also failed:', fallback.error);
      return; 
    }
    // نحوّل البيانات للشكل المتوقع
    leadersMembersCache = fallback.data.map(function(m){
      return { id: m.id, name: m.name, username: m.username, team_name: m.team_name||'', points: m.points||0, role: m.role||'member' };
    });
  } else {
    leadersMembersCache = res.data || [];
  }

  if(!leadersMembersCache.length){
    // عرض رسالة مؤقتة
    var tbody = document.getElementById("leadersTableBody");
    if(tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--mist-dim)">لسه مفيش شباب مضافين</td></tr>';
    var sel = document.getElementById("leaderMemberSelect");
    if(sel) sel.innerHTML = '<option value="">— مفيش شباب —</option>';
    return;
  }

  // ملأ select تعيين القائد
  var sel = document.getElementById("leaderMemberSelect");
  if(sel){
    sel.innerHTML = '<option value="">— اختار شاب —</option>' +
      leadersMembersCache.map(function(m){
        return '<option value="'+m.id+'" data-role="'+(m.role||'member')+'">' +
          escHtml(m.name) + (m.team_name ? ' ('+escHtml(m.team_name)+')' : ' (بدون فريق)') +
          (m.role==='leader' ? ' 👑' : '') + '</option>';
      }).join('');
    // لما يتغير الاختيار، نظهر الدور الحالي
    sel.onchange = function(){
      var opt = sel.options[sel.selectedIndex];
      if(opt && opt.dataset.role){
        var roleEl = document.getElementById('leaderRoleSelect');
        if(roleEl) roleEl.value = opt.dataset.role;
      }
    };
  }

  // ملأ جدول الأدوار
  var tbody = document.getElementById("leadersTableBody");
  if(tbody){
    var roleLabel = {
      leader: '<span class="badge-leader">👑 قائد</span>',
      member: '<span style="color:var(--mist-dim);font-size:12px">عضو</span>'
    };
    tbody.innerHTML = leadersMembersCache.map(function(m){
      return '<tr class="member-row-clickable" data-id="'+m.id+'" onclick="openMemberModal(\''+m.id+'\')">'+
        '<td>' + escHtml(m.name) + '</td>' +
        '<td>' + escHtml(m.team_name||'—') + '</td>' +
        '<td>' + (roleLabel[m.role] || roleLabel.member) + '</td>' +
        '<td>' + (m.points||0) + '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--mist-dim)">لسه مفيش شباب مضافين</td></tr>';
  }

  // ملأ اختيار أعضاء المجموعة
  renderGroupMembersCheckList();
}

async function setMemberRole(memberId, role){
  // can be called from modal (memberId, role passed directly)
  // or from hidden select (no args) — kept for compat
  if(!memberId){
    memberId = document.getElementById('leaderMemberSelect').value;
    role     = document.getElementById('leaderRoleSelect').value;
  }
  if(!memberId) return false;

  var m = leadersMembersCache.find(function(x){ return x.id===memberId; });
  var name = m ? m.name : 'هذا الشاب';
  var label = role === 'leader' ? '👑 قائد فريق' : 'عضو عادي';

  if(!confirm('هتعيّن "' + name + '" كـ ' + label + '؟')){ return false; }

  var res = await supabase.rpc('admin_set_member_role', {p_password: getAdminPass(), p_member_id: memberId, p_role: role});
  if(res.error){ return res.error; }

  loadLeadersAdmin();
  return true;
}

// ============================================================
// مجموعات المشاريع
// ============================================================
// الفريق المختار في الـ filter
var _groupFilterTeam = '';

function renderGroupFilterChips(){
  var bar = document.getElementById('groupFilterBar');
  if(!bar) return;
  // اجمع أسماء الفرق الفريدة
  var teams = [];
  leadersMembersCache.forEach(function(m){
    if(m.team_name && teams.indexOf(m.team_name) === -1) teams.push(m.team_name);
  });
  if(!teams.length){ bar.innerHTML=''; return; }
  var html = '<button class="filter-chip'+(_groupFilterTeam===''?' active':'')+'" onclick="setGroupFilter(\'\')">الكل</button>';
  teams.forEach(function(t){
    html += '<button class="filter-chip'+(_groupFilterTeam===t?' active':'')+'" onclick="setGroupFilter(\''+escHtml(t)+'\')">'+escHtml(t)+'</button>';
  });
  bar.innerHTML = html;
}

function setGroupFilter(team){
  _groupFilterTeam = team;
  renderGroupFilterChips();
  renderGroupMembersCheckList();
}

function renderGroupMembersCheckList(){
  var box = document.getElementById('groupMembersCheckList');
  if(!box) return;
  // اجمع الشباب من أي من الـ cache المتاح
  var src = leadersMembersCache.length ? leadersMembersCache : teamsMembersCache;
  if(!src.length){
    box.innerHTML = '<span style="color:var(--mist-dim);font-size:13px">لسه مفيش شباب — ضيف شباب من تاب الشباب الأول</span>';
    return;
  }
  // رندر الـ chips لو مش موجودة
  renderGroupFilterChips();
  // filter بالفريق
  var filtered = _groupFilterTeam
    ? src.filter(function(m){ return m.team_name === _groupFilterTeam; })
    : src;
  if(!filtered.length){
    box.innerHTML = '<span style="color:var(--mist-dim);font-size:13px">مفيش شباب في الفريق دا</span>';
    return;
  }
  box.innerHTML = filtered.map(function(m){
    var selected = groupSelectedIds.has(m.id);
    var roleIcon = m.role === 'leader' ? ' 👑' : '';
    return '<button class="btn small ' + (selected ? '' : 'outline') + ' grp-member-btn" data-id="' + m.id + '" style="margin:2px;position:relative">' +
      (selected ? '✅ ' : '') + escHtml(m.name) + roleIcon +
      '</button>';
  }).join('');
  box.querySelectorAll('.grp-member-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var id = btn.dataset.id;
      if(groupSelectedIds.has(id)) groupSelectedIds.delete(id); else groupSelectedIds.add(id);
      var countEl = document.getElementById('groupSelCount');
      if(countEl) countEl.textContent = 'تم اختيار: ' + groupSelectedIds.size;
      renderGroupMembersCheckList();
    });
  });
  // حدّث العداد
  var countEl = document.getElementById('groupSelCount');
  if(countEl) countEl.textContent = 'تم اختيار: ' + groupSelectedIds.size;
}

async function createProjectGroup(){
  var name    = document.getElementById('groupNameInput').value.trim();
  var ids     = Array.from(groupSelectedIds);
  var msg     = document.getElementById('groupMsg');
  if(!name){ msg.innerHTML = '<div class="error-msg" style="display:block">اكتب اسم المجموعة الأول</div>'; return; }
  if(ids.length < 2 || ids.length > 5){
    msg.innerHTML = '<div class="error-msg" style="display:block">لازم تختار من 2 لـ 5 أعضاء</div>'; return;
  }

  // ← تحقق: هل أي عضو مختار موجود بالفعل في مجموعة؟
  var existingRes = await supabase.rpc('admin_list_project_groups', { p_password: getAdminPass() });
  if(!existingRes.error && existingRes.data && existingRes.data.length){
    // نجمع كل الأعضاء الموجودين في مجموعات مع اسم مجموعتهم
    var takenMap = {};
    existingRes.data.forEach(function(row){
      takenMap[row.member_id] = row.group_name;
    });
    var conflicts = ids
      .filter(function(id){ return takenMap[id]; })
      .map(function(id){
        var m = leadersMembersCache.find(function(x){ return x.id === id; });
        return (m ? m.name : id) + ' (موجود في "' + takenMap[id] + '")';
      });
    if(conflicts.length){
      msg.innerHTML = '<div class="error-msg" style="display:block">❌ الأعضاء دول متضافين بالفعل في مجموعة:<br>• ' + conflicts.join('<br>• ') + '<br><small>امسحهم من مجموعتهم الأول</small></div>';
      return;
    }
  }

  // نجيب team_name من أول عضو مختار
  var firstMember = leadersMembersCache.find(function(m){ return m.id === ids[0]; });
  var teamName = firstMember ? (firstMember.team_name || '') : '';

  var btn = document.getElementById('createGroupBtn');
  btn.disabled = true; btn.textContent = 'بننشئ...';
  var res = await supabase.rpc('admin_create_project_group', {
    p_password: getAdminPass(),
    p_team_name: teamName,
    p_name: name,
    p_member_ids: ids
  });
  btn.disabled = false; btn.textContent = '✅ إنشاء المجموعة';
  if(res.error){
    msg.innerHTML = '<div class="error-msg" style="display:block">❌ ' + escHtml(res.error.message) + '</div>'; return;
  }
  msg.innerHTML = '<div class="success-msg" style="display:block">✅ تم إنشاء مجموعة "' + escHtml(name) + '" بـ ' + ids.length + ' أعضاء</div>';
  document.getElementById('groupNameInput').value = '';
  groupSelectedIds.clear();
  renderGroupMembersCheckList();
  var countEl = document.getElementById('groupSelCount');
  if(countEl) countEl.textContent = 'تم اختيار: 0';
  setTimeout(function(){ msg.innerHTML = ''; }, 4000);
  loadProjectGroups();
}

async function loadProjectGroups(){
  var pass = getAdminPass();
  if(!pass) return;
  var res = await supabase.rpc('admin_list_project_groups', {p_password: pass});
  var box = document.getElementById('groupsList');
  var countEl = document.getElementById('groupCount');
  if(!box) return;
  if(res.error){
    box.innerHTML = '<div class="empty-state" style="color:var(--coral)">❌ ' + escHtml(res.error.message) + '<br><small>تأكد إنك شغّلت LEADERS_AND_GROUPS.sql</small></div>';
    if(countEl) countEl.textContent = '!';
    return;
  }
  if(!res.data || res.data.length === 0){
    box.innerHTML = '<div class="empty-state">لسه مفيش مجموعات</div>';
    if(countEl) countEl.textContent = '0';
    return;
  }
  // نجمّع المجموعات (كل صف = عضو في مجموعة)
  var groups = {};
  res.data.forEach(function(row){
    if(!groups[row.group_id]){
      groups[row.group_id] = { id: row.group_id, name: row.group_name, team: row.team_name, members: [] };
    }
    groups[row.group_id].members.push(row.member_name);
  });
  var groupsArr = Object.values(groups);
  if(countEl) countEl.textContent = groupsArr.length;
  box.innerHTML = groupsArr.map(function(g){
    return '<div class="submission-item" style="align-items:flex-start">' +
      '<div style="flex:1">' +
        '<strong>' + escHtml(g.name) + '</strong>' +
        '<div style="font-size:11px;color:var(--mist-dim);margin:3px 0">فريق: ' + escHtml(g.team||'—') + '</div>' +
        '<div style="font-size:12px;color:var(--mist);margin-top:4px">👥 ' + g.members.map(escHtml).join(' · ') + '</div>' +
      '</div>' +
      '<button class="btn danger small" data-gid="' + g.id + '" style="flex-shrink:0;margin-top:2px">حذف</button>' +
    '</div>';
  }).join('');
  box.querySelectorAll('button[data-gid]').forEach(function(btn){
    btn.addEventListener('click', async function(){
      if(!confirm('هتحذف المجموعة دي؟')) return;
      await supabase.rpc('admin_delete_project_group', {p_password: getAdminPass(), p_group_id: btn.dataset.gid});
      loadProjectGroups();
    });
  });
}

// ============================================================
// 🗳️ استفتاء سريع — Admin Functions
// ============================================================

function addPollOptionField(){
  var container = document.getElementById("pollOptionsContainer");
  if(!container) return;
  var count = container.querySelectorAll(".poll-opt-input").length;
  var letters = ["A","B","C","D","E","F","G","H"];
  var inp = document.createElement("input");
  inp.className = "poll-opt-input";
  inp.type = "text";
  inp.placeholder = "خيار " + (letters[count] || count+1);
  inp.style.cssText = "width:100%;margin-bottom:8px";
  container.appendChild(inp);
}

async function adminCreatePoll(){
  var q = (document.getElementById("pollQuestion").value || "").trim();
  var inputs = document.querySelectorAll(".poll-opt-input");
  var opts = [];
  inputs.forEach(function(inp){
    var v = inp.value.trim();
    if(v) opts.push(v);
  });

  var msg = document.getElementById("pollAdminMsg");
  if(!q){ showMsg(msg, "⚠️ اكتب السؤال الأول", "error"); return; }
  if(opts.length < 2){ showMsg(msg, "⚠️ لازم خيارين على الأقل", "error"); return; }

  var btn = document.getElementById("createPollBtn");
  btn.disabled = true; btn.textContent = "جاري الإنشاء...";

  var res = await supabase.rpc("admin_create_poll", {
    p_password: getAdminPass(),
    p_question: q,
    p_options:  opts
  });

  btn.disabled = false; btn.textContent = "🚀 ابدأ الاستفتاء";

  if(res.error){ showMsg(msg, "❌ " + res.error.message, "error"); return; }
  showMsg(msg, "✅ الاستفتاء بدأ! الشباب يقدروا يصوتوا دلوقتي", "success");

  // مسح الفورم
  document.getElementById("pollQuestion").value = "";
  document.querySelectorAll(".poll-opt-input").forEach(function(inp){ inp.value = ""; });

  loadPollResults();
}

async function adminStopPoll(){
  var msg = document.getElementById("pollAdminMsg");
  if(!confirm("هتوقف الاستفتاء الحالي؟")) return;
  var res = await supabase.rpc("admin_stop_poll", { p_password: getAdminPass() });
  if(res.error){ showMsg(msg, "❌ " + res.error.message, "error"); return; }
  showMsg(msg, "⛔ الاستفتاء اتوقف", "success");
  loadPollResults();
}

async function loadPollResults(){
  var box = document.getElementById("pollResultsBox");
  if(!box) return;
  box.innerHTML = '<p style="color:var(--mist-dim);font-size:13px">بيتحمل...</p>';

  var res = await supabase.rpc("admin_get_poll_results", { p_password: getAdminPass() });
  if(res.error){ box.innerHTML = '<p style="color:#ffb3a6">❌ ' + escHtml(res.error.message) + '</p>'; return; }
  if(!res.data || res.data.length === 0){
    box.innerHTML = '<p style="color:var(--mist-dim);font-size:13px">مفيش استفتاء نشط حالياً</p>';
    return;
  }

  var rows    = res.data;
  var first   = rows[0];
  var options = first.options || [];
  var active  = first.active;
  var letters = ["A","B","C","D","E","F","G","H"];

  // احسب المجموع
  var votesMap = {}, total = 0;
  rows.forEach(function(r){
    if(r.option_idx !== null && r.option_idx !== undefined){
      votesMap[r.option_idx] = parseInt(r.vote_count) || 0;
      total += votesMap[r.option_idx];
    }
  });

  var html = '';
  html += '<div style="padding:12px 0;border-bottom:1px solid var(--line);margin-bottom:14px">';
  html += '<div style="font-size:16px;font-weight:800;color:var(--mist);margin-bottom:4px">' + escHtml(first.question) + '</div>';
  html += '<div style="font-size:12px;color:' + (active ? 'var(--pitch)' : 'var(--coral)') + '">' + (active ? '🟢 نشط' : '🔴 منتهي') + ' · إجمالي الأصوات: <strong>' + total + '</strong></div>';
  html += '</div>';

  options.forEach(function(opt, idx){
    var count = votesMap[idx] || 0;
    var pct   = total > 0 ? Math.round(count / total * 100) : 0;
    html += '<div style="margin-bottom:14px">';
    html += '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px">';
    html += '<span><strong style="color:var(--gold)">' + (letters[idx]||idx+1) + '.</strong> ' + escHtml(opt) + '</span>';
    html += '<span style="color:var(--gold);font-weight:800">' + count + ' صوت (' + pct + '%)</span>';
    html += '</div>';
    html += '<div style="height:8px;background:rgba(255,255,255,0.06);border-radius:99px;overflow:hidden">';
    html += '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,var(--gold-dim),var(--gold));border-radius:99px;transition:width .4s"></div>';
    html += '</div></div>';
  });

  box.innerHTML = html;
}

function showMsg(el, text, type){
  if(!el) return;
  el.style.display = "block";
  el.textContent = text;
  el.style.background = type === "error" ? "rgba(192,83,58,0.12)" : "rgba(74,124,111,0.12)";
  el.style.borderColor = type === "error" ? "var(--coral)" : "var(--pitch)";
  el.style.color       = type === "error" ? "#ffb3a6" : "#a9e6c4";
  el.style.padding = "10px 14px";
  el.style.borderRadius = "10px";
  el.style.border = "1px solid";
  el.style.fontSize = "13px";
  setTimeout(function(){ el.style.display = "none"; }, 4000);
}

// ============================================================
// Member Edit Modal
// ============================================================
var _modalMemberId = null;

function openMemberModal(memberId){
  // ابحث في كلا الـ cache
  var m = teamsMembersCache.find(function(x){ return x.id===memberId; })
       || leadersMembersCache.find(function(x){ return x.id===memberId; });
  if(!m) return;

  _modalMemberId = memberId;

  document.getElementById('modalMemberName').textContent = m.name;
  document.getElementById('modalTeamName').value  = m.team_name || '';
  document.getElementById('modalPoints').value    = m.points    || 0;
  document.getElementById('modalRole').value      = m.role      || 'member';
  document.getElementById('modalMsg').innerHTML   = '';

  // إظهار/إخفاء صف الغرفة
  var roomRow = document.getElementById('modalRoomRow');
  if(roomRow) roomRow.style.display = (m.role === 'room_admin') ? 'block' : 'none';

  document.getElementById('memberModal').classList.add('open');
  document.getElementById('modalTeamName').focus();
}

function closeMemberModal(){
  document.getElementById('memberModal').classList.remove('open');
  _modalMemberId = null;
}

async function saveMemberModal(){
  if(!_modalMemberId) return;

  var team   = document.getElementById('modalTeamName').value.trim();
  var points = parseInt(document.getElementById('modalPoints').value) || 0;
  var role   = document.getElementById('modalRole').value;
  var msg    = document.getElementById('modalMsg');
  var btn    = document.getElementById('modalSaveBtn');

  // تحقق من تغيير الدور
  var cached = teamsMembersCache.find(function(x){ return x.id===_modalMemberId; })
            || leadersMembersCache.find(function(x){ return x.id===_modalMemberId; });
  var roleChanged  = cached && cached.role !== role;
  var roleLabel    = role === 'leader' ? '👑 قائد فريق' : 'عضو عادي';

  if(roleChanged){
    var name = cached ? cached.name : 'هذا الشاب';
    if(!confirm('هتعيّن "' + name + '" كـ ' + roleLabel + '؟')){ return; }
  }

  btn.disabled = true; btn.textContent = 'بنحفظ...';

  // 1) حفظ الفريق والنقاط
  var r1 = await supabase.rpc('admin_set_member_team', {
    p_password: getAdminPass(), p_member_id: _modalMemberId,
    p_team_name: team, p_points: points
  });

  // 2) حفظ الدور (لو اتغير أو مختلف)
  var r2 = { error: null };
  if(roleChanged){
    if(role === 'room_admin'){
      // تعيين أمين غرفة — محتاج اسم الغرفة
      var roomSel = document.getElementById('modalRoomSelect');
      var roomName = roomSel ? roomSel.value : '';
      if(!roomName){
        showModalMsg('❌ اختار الغرفة الأول', 'error');
        btn.disabled = false; btn.textContent = '💾 حفظ';
        return;
      }
      r2 = await supabase.rpc('admin_assign_room', {
        p_password: getAdminPass(), p_member_id: _modalMemberId, p_room_name: roomName
      });
    } else {
      r2 = await supabase.rpc('admin_set_member_role', {
        p_password: getAdminPass(), p_member_id: _modalMemberId, p_role: role
      });
    }
  }

  btn.disabled = false; btn.textContent = '💾 حفظ';

  if(r1.error || r2.error){
    var errMsg = (r1.error||r2.error).message;
    showModalMsg('❌ حصل خطأ: ' + errMsg, 'error');
    return;
  }

  showModalMsg('✅ تم الحفظ' + (roleChanged ? ' — الدور: ' + roleLabel : ''), 'success');

  // ريفرش الجداول
  await loadTeamsAdmin();
  if(typeof loadLeadersAdmin === 'function') loadLeadersAdmin();

  setTimeout(closeMemberModal, 1200);
}

function showModalMsg(text, type){
  var el = document.getElementById('modalMsg');
  if(!el) return;
  el.innerHTML = '<div class="'+(type==='error'?'error-msg':'success-msg')+'" style="display:block">'+escHtml(text)+'</div>';
}

// ربط الأزرار والـ overlay
document.addEventListener('DOMContentLoaded', function(){
  var modal      = document.getElementById('memberModal');
  var cancelBtn  = document.getElementById('modalCancelBtn');
  var saveBtn    = document.getElementById('modalSaveBtn');
  if(!modal) return;

  if(cancelBtn) cancelBtn.addEventListener('click', closeMemberModal);
  if(saveBtn)   saveBtn.addEventListener('click',  saveMemberModal);

  // إظهار/إخفاء صف الغرفة لما يتغير الدور
  var modalRole = document.getElementById('modalRole');
  if(modalRole){
    modalRole.addEventListener('change', function(){
      var roomRow = document.getElementById('modalRoomRow');
      if(roomRow) roomRow.style.display = (modalRole.value === 'room_admin') ? 'block' : 'none';
    });
  }

  // إغلاق بالضغط على الخلفية
  modal.addEventListener('click', function(e){
    if(e.target === modal) closeMemberModal();
  });

  // إغلاق بـ Escape
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && modal.classList.contains('open')) closeMemberModal();
  });
});

// ============================================================
// تحميل تاب الدرجات لما ينفتح
// ============================================================
(function watchScoresTab(){
  var panel = document.getElementById('panel-scores');
  if(!panel) return;
  var loaded = false;
  var observer = new MutationObserver(function(){
    if(panel.classList.contains('active') && !loaded){
      loaded = true;
      loadRoomScores();
      loadProjectScores();
    }
    if(!panel.classList.contains('active')) loaded = false;
  });
  observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
})();

async function loadRoomScores(){
  var box = document.getElementById('roomScoresList');
  if(!box) return;
  var res = await supabase.rpc('admin_list_room_scores', { p_password: getAdminPass() });
  if(res.error || !res.data || !res.data.length){
    box.innerHTML = '<div class="empty-state">لسه مفيش درجات غرف</div>'; return;
  }
  box.innerHTML = '<table><thead><tr><th>الغرفة</th><th>الفريق</th><th>الدرجة الكلية</th><th>الحاضرين</th><th>نصيب الفرد</th><th>التاريخ</th><th>الأمين</th></tr></thead><tbody>' +
    res.data.map(function(r){
      return '<tr><td>'+escHtml(r.room_name)+'</td><td>'+escHtml(r.team_name)+'</td>' +
        '<td style="color:var(--gold);font-weight:700">'+r.total_score+'</td>' +
        '<td>'+r.present_count+'</td>' +
        '<td style="color:var(--pitch);font-weight:700">'+parseFloat(r.score_per_member).toFixed(1)+'</td>' +
        '<td style="font-size:11px;color:var(--mist-dim)">'+r.session_date+'</td>' +
        '<td style="font-size:11px">'+escHtml(r.admin_name)+'</td></tr>';
    }).join('') + '</tbody></table>';
}

async function loadProjectScores(){
  var box = document.getElementById('projectScoresList');
  if(!box) return;
  var res = await supabase.rpc('admin_list_project_scores', { p_password: getAdminPass() });
  if(res.error || !res.data || !res.data.length){
    box.innerHTML = '<div class="empty-state">لسه مفيش درجات مشروع</div>'; return;
  }
  box.innerHTML = '<table><thead><tr><th>المجموعة</th><th>الفريق</th><th>الدرجة</th><th>ملاحظة</th><th>المصحح</th></tr></thead><tbody>' +
    res.data.map(function(r){
      return '<tr><td>'+escHtml(r.group_name)+'</td><td>'+escHtml(r.team_name)+'</td>' +
        '<td style="color:var(--gold);font-weight:700">'+r.score+'</td>' +
        '<td style="font-size:11px;color:var(--mist-dim)">'+escHtml(r.note||'—')+'</td>' +
        '<td style="font-size:11px">'+escHtml(r.reviewer_name)+'</td></tr>';
    }).join('') + '</tbody></table>';
}
