// ============================================================
// adminextra.js — الفرق، البرنامج، الجاسوس، درس الكتاب
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

  var setLeaderBtn = document.getElementById('setLeaderBtn');
  if(setLeaderBtn) setLeaderBtn.addEventListener('click', setMemberRole);
  var createGroupBtn = document.getElementById('createGroupBtn');
  if(createGroupBtn) createGroupBtn.addEventListener('click', createProjectGroup);
});

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
  leadersMembersCache=teamsMembersCache.slice();
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
    room_admin:'<span style="color:var(--gold);font-size:12px">🏠 أمين غرفة</span>',
    retreat_servant:'<span style="color:#a9e6c4;font-size:12px">🕊️ خادم الخلوة</span>',
    project_reviewer:'<span style="color:var(--pitch);font-size:12px">📝 مصحح</span>',
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
// درس الكتاب
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
// القادة
// ============================================================
async function loadLeadersAdmin(){
  var pass = getAdminPass();
  if(!pass){ return; }
  if(teamsMembersCache.length){
    leadersMembersCache = teamsMembersCache;
  } else {
    var res = await supabase.rpc("admin_list_members_teams", {p_password: pass});
    if(res.error){
      var fallback = await supabase.rpc("admin_list_members", {p_password: pass});
      if(fallback.error || !fallback.data){ return; }
      leadersMembersCache = fallback.data.map(function(m){
        return { id: m.id, name: m.name, username: m.username, team_name: m.team_name||'', points: m.points||0, role: m.role||'member' };
      });
    } else {
      leadersMembersCache = res.data || [];
    }
  }
  if(!leadersMembersCache.length){ return; }
  var sel = document.getElementById("leaderMemberSelect");
  if(sel){
    sel.innerHTML = '<option value="">— اختار شاب —</option>' +
      leadersMembersCache.map(function(m){
        return '<option value="'+m.id+'" data-role="'+(m.role||'member')+'">' +
          escHtml(m.name) + (m.team_name ? ' ('+escHtml(m.team_name)+')' : ' (بدون فريق)') +
          (m.role==='leader' ? ' 👑' : '') + '</option>';
      }).join('');
    sel.onchange = function(){
      var opt = sel.options[sel.selectedIndex];
      if(opt && opt.dataset.role){
        var roleEl = document.getElementById('leaderRoleSelect');
        if(roleEl) roleEl.value = opt.dataset.role;
      }
    };
  }
  var tbody = document.getElementById("leadersTableBody");
  if(tbody){
    var roleLabel = {
      leader: '<span class="badge-leader">👑 قائد</span>',
      room_admin: '<span style="color:var(--gold);font-size:12px">🏠 أمين غرفة</span>',
      retreat_servant: '<span style="color:#a9e6c4;font-size:12px">🕊️ خادم الخلوة</span>',
      project_reviewer: '<span style="color:var(--pitch);font-size:12px">📝 مصحح</span>',
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
  await loadTakenMembersMap(false);
  renderGroupMembersCheckList();
}

async function setMemberRole(memberId, role){
  if(!memberId){
    memberId = document.getElementById('leaderMemberSelect').value;
    role     = document.getElementById('leaderRoleSelect').value;
  }
  if(!memberId) return false;
  var m = leadersMembersCache.find(function(x){ return x.id===memberId; });
  var name = m ? m.name : 'هذا الشاب';
  var label = {leader:'👑 قائد فريق', room_admin:'🏠 أمين غرفة', retreat_servant:'🕊️ خادم الخلوة', project_reviewer:'📝 مصحح مشروع'}[role] || 'عضو عادي';
  if(!confirm('هتعيّن "' + name + '" كـ ' + label + '؟')){ return false; }
  var res = await supabase.rpc('admin_set_member_role', {p_password: getAdminPass(), p_member_id: memberId, p_role: role});
  if(res.error){ return res.error; }
  loadLeadersAdmin();
  return true;
}

// ============================================================
// مجموعات المشاريع
// ============================================================
var _groupFilterTeam = '';
var _takenMembersMap = {};

function renderGroupFilterChips(){
  var bar = document.getElementById('groupFilterBar');
  if(!bar) return;
  var src = leadersMembersCache.length ? leadersMembersCache : teamsMembersCache;
  var teams = [], seenTeams = {};
  src.forEach(function(m){
    if(m.team_name && !seenTeams[m.team_name]){ seenTeams[m.team_name]=true; teams.push(m.team_name); }
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
  var src = leadersMembersCache.length ? leadersMembersCache : teamsMembersCache;
  if(!src.length){ box.innerHTML = '<span style="color:var(--mist-dim);font-size:13px">لسه مفيش شباب</span>'; return; }
  var seen = {}, unique = src.filter(function(m){ if(seen[m.id]) return false; seen[m.id]=true; return true; });
  renderGroupFilterChips();
  var filtered = _groupFilterTeam ? unique.filter(function(m){ return m.team_name===_groupFilterTeam; }) : unique;
  if(!filtered.length){ box.innerHTML = '<span style="color:var(--mist-dim);font-size:13px">مفيش شباب في الفريق دا</span>'; return; }
  box.innerHTML = filtered.map(function(m){
    var selected = groupSelectedIds.has(m.id);
    var takenIn  = _takenMembersMap[m.id];
    var roleIcon = m.role === 'leader' ? ' 👑' : '';
    if(takenIn){
      return '<button class="btn small outline grp-member-btn" data-id="'+m.id+'" data-taken="1" title="موجود في: '+escHtml(takenIn)+'" style="margin:2px;opacity:0.38;cursor:not-allowed">🔒 '+escHtml(m.name)+roleIcon+'</button>';
    }
    return '<button class="btn small '+(selected?'':'outline')+' grp-member-btn" data-id="'+m.id+'" style="margin:2px">'+(selected?'✅ ':'')+escHtml(m.name)+roleIcon+'</button>';
  }).join('');
  box.querySelectorAll('.grp-member-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      if(btn.dataset.taken) return;
      var id = btn.dataset.id;
      if(groupSelectedIds.has(id)) groupSelectedIds.delete(id); else groupSelectedIds.add(id);
      var countEl = document.getElementById('groupSelCount');
      if(countEl) countEl.textContent = 'تم اختيار: ' + groupSelectedIds.size;
      renderGroupMembersCheckList();
    });
  });
  var countEl = document.getElementById('groupSelCount');
  if(countEl) countEl.textContent = 'تم اختيار: ' + groupSelectedIds.size;
}

async function loadTakenMembersMap(andRender){
  var res = await supabase.rpc('admin_list_project_groups', { p_password: getAdminPass() });
  _takenMembersMap = {};
  if(!res.error && res.data){ res.data.forEach(function(row){ _takenMembersMap[row.member_id] = row.group_name; }); }
  if(andRender) renderGroupMembersCheckList();
}

async function createProjectGroup(){
  var name = document.getElementById('groupNameInput').value.trim();
  var ids  = Array.from(groupSelectedIds);
  var msg  = document.getElementById('groupMsg');
  if(!name){ msg.innerHTML = '<div class="error-msg" style="display:block">اكتب اسم المجموعة الأول</div>'; return; }
  if(ids.length < 2 || ids.length > 5){ msg.innerHTML = '<div class="error-msg" style="display:block">لازم تختار من 2 لـ 5 أعضاء</div>'; return; }
  var existingRes = await supabase.rpc('admin_list_project_groups', { p_password: getAdminPass() });
  if(!existingRes.error && existingRes.data && existingRes.data.length){
    var takenMap = {};
    existingRes.data.forEach(function(row){ takenMap[row.member_id] = row.group_name; });
    var conflicts = ids.filter(function(id){ return takenMap[id]; }).map(function(id){
      var m = leadersMembersCache.find(function(x){ return x.id===id; });
      return (m?m.name:id) + ' (موجود في "' + takenMap[id] + '")';
    });
    if(conflicts.length){ msg.innerHTML = '<div class="error-msg" style="display:block">❌ الأعضاء دول متضافين بالفعل:<br>• '+conflicts.join('<br>• ')+'</div>'; return; }
  }
  var firstMember = leadersMembersCache.find(function(m){ return m.id===ids[0]; });
  var teamName = firstMember ? (firstMember.team_name||'') : '';
  var btn = document.getElementById('createGroupBtn');
  btn.disabled=true; btn.textContent='بننشئ...';
  var res = await supabase.rpc('admin_create_project_group', { p_password:getAdminPass(), p_team_name:teamName, p_name:name, p_member_ids:ids });
  btn.disabled=false; btn.textContent='✅ إنشاء المجموعة';
  if(res.error){ msg.innerHTML='<div class="error-msg" style="display:block">❌ '+escHtml(res.error.message)+'</div>'; return; }
  msg.innerHTML='<div class="success-msg" style="display:block">✅ تم إنشاء مجموعة "'+escHtml(name)+'" بـ '+ids.length+' أعضاء</div>';
  document.getElementById('groupNameInput').value='';
  groupSelectedIds.clear();
  setTimeout(function(){ msg.innerHTML=''; }, 4000);
  loadProjectGroups();
}

async function loadProjectGroups(){
  var pass = getAdminPass();
  if(!pass) return;
  var res = await supabase.rpc('admin_list_project_groups', {p_password: pass});
  var box = document.getElementById('groupsList');
  var countEl = document.getElementById('groupCount');
  if(!box) return;
  if(res.error){ box.innerHTML='<div class="empty-state" style="color:var(--coral)">❌ '+escHtml(res.error.message)+'</div>'; if(countEl) countEl.textContent='!'; return; }
  if(!res.data||res.data.length===0){ box.innerHTML='<div class="empty-state">لسه مفيش مجموعات</div>'; if(countEl) countEl.textContent='0'; return; }
  var groups = {};
  res.data.forEach(function(row){
    if(!groups[row.group_id]) groups[row.group_id]={id:row.group_id,name:row.group_name,team:row.team_name,members:[]};
    groups[row.group_id].members.push(row.member_name);
  });
  var groupsArr = Object.values(groups);
  if(countEl) countEl.textContent=groupsArr.length;
  box.innerHTML=groupsArr.map(function(g){
    return '<div class="submission-item" style="align-items:flex-start">'+
      '<div style="flex:1"><strong>'+escHtml(g.name)+'</strong>'+
      '<div style="font-size:11px;color:var(--mist-dim);margin:3px 0">فريق: '+escHtml(g.team||'—')+'</div>'+
      '<div style="font-size:12px;color:var(--mist);margin-top:4px">👥 '+g.members.map(escHtml).join(' · ')+'</div></div>'+
      '<button class="btn danger small" data-gid="'+g.id+'" style="flex-shrink:0;margin-top:2px">حذف</button></div>';
  }).join('');
  box.querySelectorAll('button[data-gid]').forEach(function(btn){
    btn.addEventListener('click', async function(){
      if(!confirm('هتحذف المجموعة دي؟')) return;
      await supabase.rpc('admin_delete_project_group', {p_password:getAdminPass(), p_group_id:btn.dataset.gid});
      loadProjectGroups();
    });
  });
  loadTakenMembersMap(true);
}

// ============================================================
// الاستفتاء
// ============================================================
function addPollOptionField(){
  var container = document.getElementById("pollOptionsContainer");
  if(!container) return;
  var count = container.querySelectorAll(".poll-opt-input").length;
  var letters = ["A","B","C","D","E","F","G","H"];
  var inp = document.createElement("input");
  inp.className="poll-opt-input"; inp.type="text";
  inp.placeholder="خيار "+(letters[count]||count+1);
  inp.style.cssText="width:100%;margin-bottom:8px";
  container.appendChild(inp);
}

async function adminCreatePoll(){
  var q=(document.getElementById("pollQuestion").value||"").trim();
  var inputs=document.querySelectorAll(".poll-opt-input");
  var opts=[];
  inputs.forEach(function(inp){ var v=inp.value.trim(); if(v) opts.push(v); });
  var msg=document.getElementById("pollAdminMsg");
  if(!q){ showMsg(msg,"⚠️ اكتب السؤال الأول","error"); return; }
  if(opts.length<2){ showMsg(msg,"⚠️ لازم خيارين على الأقل","error"); return; }
  var btn=document.getElementById("createPollBtn");
  btn.disabled=true; btn.textContent="جاري الإنشاء...";
  var res=await supabase.rpc("admin_create_poll",{p_password:getAdminPass(),p_question:q,p_options:opts});
  btn.disabled=false; btn.textContent="🚀 ابدأ الاستفتاء";
  if(res.error){ showMsg(msg,"❌ "+res.error.message,"error"); return; }
  showMsg(msg,"✅ الاستفتاء بدأ!","success");
  document.getElementById("pollQuestion").value="";
  document.querySelectorAll(".poll-opt-input").forEach(function(inp){ inp.value=""; });
  loadPollResults();
}

async function adminStopPoll(){
  var msg=document.getElementById("pollAdminMsg");
  if(!confirm("هتوقف الاستفتاء الحالي؟")) return;
  var res=await supabase.rpc("admin_stop_poll",{p_password:getAdminPass()});
  if(res.error){ showMsg(msg,"❌ "+res.error.message,"error"); return; }
  showMsg(msg,"⛔ الاستفتاء اتوقف","success");
  loadPollResults();
}

async function loadPollResults(){
  var box=document.getElementById("pollResultsBox");
  if(!box) return;
  box.innerHTML='<p style="color:var(--mist-dim);font-size:13px">بيتحمل...</p>';
  var res=await supabase.rpc("admin_get_poll_results",{p_password:getAdminPass()});
  if(res.error){ box.innerHTML='<p style="color:#ffb3a6">❌ '+escHtml(res.error.message)+'</p>'; return; }
  if(!res.data||res.data.length===0){ box.innerHTML='<p style="color:var(--mist-dim);font-size:13px">مفيش استفتاء نشط حالياً</p>'; return; }
  var rows=res.data, first=rows[0], options=first.options||[], active=first.active, letters=["A","B","C","D","E","F","G","H"];
  var votesMap={}, total=0;
  rows.forEach(function(r){ if(r.option_idx!==null&&r.option_idx!==undefined){ votesMap[r.option_idx]=parseInt(r.vote_count)||0; total+=votesMap[r.option_idx]; } });
  var html='<div style="padding:12px 0;border-bottom:1px solid var(--line);margin-bottom:14px">';
  html+='<div style="font-size:16px;font-weight:800;color:var(--mist);margin-bottom:4px">'+escHtml(first.question)+'</div>';
  html+='<div style="font-size:12px;color:'+(active?'var(--pitch)':'var(--coral)')+'">'+(active?'🟢 نشط':'🔴 منتهي')+' · إجمالي الأصوات: <strong>'+total+'</strong></div></div>';
  options.forEach(function(opt,idx){
    var count=votesMap[idx]||0, pct=total>0?Math.round(count/total*100):0;
    html+='<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px">';
    html+='<span><strong style="color:var(--gold)">'+(letters[idx]||idx+1)+'.</strong> '+escHtml(opt)+'</span>';
    html+='<span style="color:var(--gold);font-weight:800">'+count+' صوت ('+pct+'%)</span></div>';
    html+='<div style="height:8px;background:rgba(255,255,255,0.06);border-radius:99px;overflow:hidden">';
    html+='<div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,var(--gold-dim),var(--gold));border-radius:99px;transition:width .4s"></div></div></div>';
  });
  box.innerHTML=html;
}

function showMsg(el,text,type){
  if(!el) return;
  el.style.display="block"; el.textContent=text;
  el.style.background=type==="error"?"rgba(192,83,58,0.12)":"rgba(74,124,111,0.12)";
  el.style.borderColor=type==="error"?"var(--coral)":"var(--pitch)";
  el.style.color=type==="error"?"#ffb3a6":"#a9e6c4";
  el.style.padding="10px 14px"; el.style.borderRadius="10px";
  el.style.border="1px solid"; el.style.fontSize="13px";
  setTimeout(function(){ el.style.display="none"; },4000);
}

// ============================================================
// Member Edit Modal
// ============================================================
var _modalMemberId = null;

function openMemberModal(memberId){
  var m=teamsMembersCache.find(function(x){ return x.id===memberId; })||leadersMembersCache.find(function(x){ return x.id===memberId; });
  if(!m) return;
  _modalMemberId=memberId;
  document.getElementById('modalMemberName').textContent=m.name;
  document.getElementById('modalMemberNameInput').value=m.name||'';
  document.getElementById('modalTeamName').value=m.team_name||'';
  document.getElementById('modalPoints').value=m.points||0;
  document.getElementById('modalRole').value=m.role||'member';
  document.getElementById('modalMsg').innerHTML='';
  var roomRow=document.getElementById('modalRoomRow');
  if(roomRow) roomRow.style.display=(m.role==='room_admin'||m.role==='retreat_servant')?'block':'none';
  // جيب الغرفة الحالية للأمين وحددها في الـ select
  if(m.role==='room_admin'||m.role==='retreat_servant'){
    supabase.from('room_assignments').select('room_name').eq('member_id',memberId).single().then(function(rr){
      var sel=document.getElementById('modalRoomSelect');
      if(sel) sel.value=(rr.data&&rr.data.room_name)||'';
    });
  } else {
    var sel=document.getElementById('modalRoomSelect');
    if(sel) sel.value='';
  }
  document.getElementById('memberModal').classList.add('open');
  document.getElementById('modalTeamName').focus();
}

function closeMemberModal(){
  document.getElementById('memberModal').classList.remove('open');
  _modalMemberId=null;
}

async function saveMemberModal(){
  if(!_modalMemberId) return;
  var team=document.getElementById('modalTeamName').value.trim();
  var newName=document.getElementById('modalMemberNameInput').value.trim();
  var points=parseInt(document.getElementById('modalPoints').value)||0;
  var role=document.getElementById('modalRole').value;
  var msg=document.getElementById('modalMsg');
  var btn=document.getElementById('modalSaveBtn');
  var cached=teamsMembersCache.find(function(x){ return x.id===_modalMemberId; })||leadersMembersCache.find(function(x){ return x.id===_modalMemberId; });
  var roleChanged=cached&&cached.role!==role;
  var roleLabelMap={'leader':'👑 قائد فريق','room_admin':'🏠 أمين غرفة','retreat_servant':'🕊️ خادم الخلوة','project_reviewer':'📝 مصحح مشروع','member':'عضو عادي'};
  var roleLabel=roleLabelMap[role]||'عضو عادي';
  if(roleChanged){ var name=cached?cached.name:'هذا الشاب'; if(!confirm('هتعيّن "'+name+'" كـ '+roleLabel+'؟')){ return; } }
  if(!newName){ showModalMsg('❌ الاسم مش ممكن يكون فاضي','error'); return; }
  btn.disabled=true; btn.textContent='بنحفظ...';
  var r1=await supabase.rpc('admin_set_member_team',{p_password:getAdminPass(),p_member_id:_modalMemberId,p_team_name:team,p_points:points});
  var rName={error:null};
  if(cached&&cached.name!==newName){
    rName=await supabase.rpc('admin_update_member_name',{p_password:getAdminPass(),p_member_id:_modalMemberId,p_name:newName});
    if(!rName.error) rName.error=rName.data==='unauthorized'?{message:'غير مصرح'}:null;
  }
  var r2={error:null};
  if(roleChanged){
    if(role==='room_admin'||role==='retreat_servant'){
      var roomSel=document.getElementById('modalRoomSelect');
      var roomName=roomSel?roomSel.value:'';
      if(!roomName){ showModalMsg('❌ اختار الغرفة الأول','error'); btn.disabled=false; btn.textContent='💾 حفظ'; return; }
      r2=await supabase.rpc('admin_assign_room',{p_password:getAdminPass(),p_member_id:_modalMemberId,p_room_name:roomName});
    } else {
      r2=await supabase.rpc('admin_set_member_role',{p_password:getAdminPass(),p_member_id:_modalMemberId,p_role:role});
    }
  }
  btn.disabled=false; btn.textContent='💾 حفظ';
  if(r1.error||r2.error||rName.error){ showModalMsg('❌ حصل خطأ: '+(r1.error||r2.error||rName.error).message,'error'); return; }
  showModalMsg('✅ تم الحفظ'+(roleChanged?' — الدور: '+roleLabel:''),'success');
  if(cached&&cached.name!==newName){ cached.name=newName; document.getElementById('modalMemberName').textContent=newName; }
  await loadTeamsAdmin();
  if(typeof loadLeadersAdmin==='function') loadLeadersAdmin();
  setTimeout(closeMemberModal,1200);
}

function showModalMsg(text,type){
  var el=document.getElementById('modalMsg');
  if(!el) return;
  el.innerHTML='<div class="'+(type==='error'?'error-msg':'success-msg')+'" style="display:block">'+escHtml(text)+'</div>';
}

document.addEventListener('DOMContentLoaded', function(){
  var modal=document.getElementById('memberModal');
  var cancelBtn=document.getElementById('modalCancelBtn');
  var saveBtn=document.getElementById('modalSaveBtn');
  if(!modal) return;
  if(cancelBtn) cancelBtn.addEventListener('click',closeMemberModal);
  if(saveBtn)   saveBtn.addEventListener('click',saveMemberModal);
  var modalRole=document.getElementById('modalRole');
  if(modalRole){
    modalRole.addEventListener('change',function(){
      var roomRow=document.getElementById('modalRoomRow');
      if(roomRow) roomRow.style.display=(modalRole.value==='room_admin'||modalRole.value==='retreat_servant')?'block':'none';
    });
  }
  modal.addEventListener('click',function(e){ if(e.target===modal) closeMemberModal(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&modal.classList.contains('open')) closeMemberModal(); });
});

// ============================================================
// تاب الدرجات — Cards للفرق + تفاصيل كل عضو
// ============================================================
(function watchScoresTab(){
  var panel=document.getElementById('panel-scores');
  if(!panel) return;
  var observer=new MutationObserver(function(){
    if(panel.classList.contains('active')){ loadRoomScores(); loadProjectScores(); }
  });
  observer.observe(panel,{attributes:true,attributeFilter:['class']});
})();

function scoresTableWrap(html){
  return '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch">'+html+'</div>';
}

// ── حالة العرض في تاب الدرجات ──
var _scoresView = 'teams';   // 'teams' | 'team_detail' | 'member_detail'
var _scoresTeam = '';
var _scoresMemberId = '';
var _scoresAllData = [];     // كل room_attendance
var _scoresMemberPoints = {};// { member_id: { room:[], qr:[], wheel:[], retreat:[], puzzle:[], dailyq:[], project:[] } }

async function loadRoomScores(){
  var box=document.getElementById('roomScoresList');
  if(!box) return;
  box.innerHTML='<div class="empty-state">بنحمّل...</div>';

  // جيب كل الداتا
  var [detRes, qrRes, wheelRes, retreatRes, puzzleRes, dailyqRes, projectRes, badgeRes] = await Promise.all([
    supabase.rpc('admin_list_room_details', {p_password:getAdminPass()}),
    supabase.from('attendance').select('member_id,scan_type,scanned_at').order('scanned_at',{ascending:false}),
    supabase.from('wheel_spins').select('member_id,prize_key,prize_label,points_won,spun_at').order('spun_at',{ascending:false}),
    supabase.from('retreat_bookings').select('member_id,slot_id,booked_at').order('booked_at',{ascending:false}),
    supabase.from('puzzle_completions').select('member_id,completed_at').order('completed_at',{ascending:false}),
    supabase.from('daily_question_answers').select('member_id,is_correct,answered_at').order('answered_at',{ascending:false}),
    supabase.rpc('admin_list_project_scores',{p_password:getAdminPass()}),
    supabase.from('member_badges').select('member_id,badge_key,earned_at').order('earned_at',{ascending:false})
  ]);

  _scoresAllData = detRes.data || [];

  // بنى خريطة الأعضاء
  var membersMap = {};
  teamsMembersCache.forEach(function(m){ membersMap[m.id]=m; });

  // جمّع الفرق
  var teams = {}, seenTeams = {};
  teamsMembersCache.forEach(function(m){
    if(!m.team_name) return;
    if(!seenTeams[m.team_name]){
      seenTeams[m.team_name]=true;
      teams[m.team_name]={ name:m.team_name, members:[], totalPts:0 };
    }
    if(m.role==='member'){
      teams[m.team_name].members.push(m);
      teams[m.team_name].totalPts += (m.points||0);
    }
  });

  // احسب نقاط الغرف لكل فريق
  var roomPtsByTeam = {};
  _scoresAllData.forEach(function(r){
    var t = r.team_name||'—';
    if(!roomPtsByTeam[t]) roomPtsByTeam[t]=0;
    roomPtsByTeam[t]+=(r.session_pts||0)+(r.bonus_pts||0);
  });

  _scoresView='teams';
  renderTeamCards(teams, roomPtsByTeam);

  // حفظ الداتا الإضافية عشان نستخدمها في التفاصيل
  window._extraData = {
    qr: qrRes.data||[],
    wheel: wheelRes.data||[],
    retreat: retreatRes.data||[],
    puzzle: puzzleRes.data||[],
    dailyq: dailyqRes.data||[],
    project: projectRes.data||[],
    badge: badgeRes.data||[]
  };
}

function renderTeamCards(teams, roomPtsByTeam){
  var box=document.getElementById('roomScoresList');
  if(!box) return;

  var teamsArr = Object.values(teams);
  if(!teamsArr.length){ box.innerHTML='<div class="empty-state">لسه مفيش بيانات</div>'; return; }

  // ترتيب حسب النقاط
  teamsArr.sort(function(a,b){ return b.totalPts - a.totalPts; });
  var medals=['🥇','🥈','🥉'];

  var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px">';
  teamsArr.forEach(function(team, i){
    var roomPts = roomPtsByTeam[team.name]||0;
    html += '<div onclick="showTeamDetail(\''+escHtml(team.name)+'\')" style="'+
      'background:var(--ink-2);border:1px solid var(--line);border-radius:14px;padding:16px 14px;'+
      'cursor:pointer;transition:all .2s;text-align:center" '+
      'onmouseover="this.style.borderColor=\'rgba(200,150,90,.5)\'" '+
      'onmouseout="this.style.borderColor=\'var(--line)\'">';
    html += '<div style="font-size:24px;margin-bottom:6px">'+(medals[i]||'🏅')+'</div>';
    html += '<div style="font-family:var(--font-display);font-weight:800;font-size:16px;color:var(--mist);margin-bottom:10px">'+escHtml(team.name)+'</div>';
    html += '<div style="font-family:var(--font-display);font-size:28px;font-weight:800;color:var(--gold)">'+team.totalPts+'</div>';
    html += '<div style="font-size:11px;color:var(--mist-dim);margin-top:2px">نقطة إجمالي</div>';
    html += '<div style="display:flex;justify-content:center;gap:12px;margin-top:12px;padding-top:10px;border-top:1px solid var(--line)">';
    html += '<div><div style="font-size:13px;font-weight:700;color:#a9e6c4">'+team.members.length+'</div><div style="font-size:10px;color:var(--mist-dim)">عضو</div></div>';
    html += '<div><div style="font-size:13px;font-weight:700;color:var(--gold)">'+roomPts+'</div><div style="font-size:10px;color:var(--mist-dim)">نقاط غرف</div></div>';
    html += '</div>';
    html += '<div style="font-size:11px;color:var(--gold);margin-top:10px;opacity:0.7">اضغط للتفاصيل ←</div>';
    html += '</div>';
  });
  html += '</div>';

  // ── قايمة كل الأعضاء ──
  html += '<div style="font-size:11px;font-weight:700;color:var(--mist-dim);letter-spacing:1px;margin-bottom:12px">👥 كل الأعضاء</div>';
  html += '<div style="display:flex;flex-direction:column;gap:6px">';

  // رتّب الأعضاء حسب النقاط
  var allMembers = teamsMembersCache.filter(function(m){ return m.role==='member'; });
  allMembers.sort(function(a,b){ return (b.points||0)-(a.points||0); });

  allMembers.forEach(function(m){
    html += '<div onclick="showMemberDetail(\''+m.id+'\')" style="'+
      'display:flex;align-items:center;justify-content:space-between;'+
      'padding:10px 12px;background:var(--ink-2);border:1px solid var(--line);border-radius:10px;'+
      'cursor:pointer;transition:all .2s" '+
      'onmouseover="this.style.borderColor=\'rgba(200,150,90,.4)\'" '+
      'onmouseout="this.style.borderColor=\'var(--line)\'">';
    html += '<div style="display:flex;align-items:center;gap:10px">';
    html += '<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--gold),var(--coral));display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#fff">'+escHtml((m.name||'?').charAt(0))+'</div>';
    html += '<div><div style="font-size:13px;font-weight:600;color:var(--mist)">'+escHtml(m.name)+'</div>';
    html += '<div style="font-size:11px;color:var(--mist-dim)">'+escHtml(m.team_name||'—')+'</div></div></div>';
    html += '<div style="display:flex;align-items:center;gap:8px">';
    html += '<span style="font-family:var(--font-display);font-weight:800;font-size:16px;color:var(--gold)">'+(m.points||0)+'</span>';
    html += '<span style="font-size:10px;color:var(--mist-dim)">نقطة</span>';
    html += '<span style="font-size:12px;color:var(--gold);opacity:0.6">←</span>';
    html += '</div></div>';
  });
  html += '</div>';

  box.innerHTML = html;
}

function showTeamDetail(teamName){
  _scoresView='team_detail';
  _scoresTeam=teamName;
  var box=document.getElementById('roomScoresList');
  if(!box) return;

  var teamMembers = teamsMembersCache.filter(function(m){ return m.team_name===teamName && m.role==='member'; });
  var roomRows    = _scoresAllData.filter(function(r){ return r.team_name===teamName; });

  // ملخص الغرف
  var roomSummary = {};
  roomRows.forEach(function(r){
    var rname = r.room_name||r.secretary_name||'—';
    if(!roomSummary[rname]) roomSummary[rname]={secretary:r.secretary_name||'—', roomName:rname, present:0, total:0, date:r.session_date};
    if(r.session_pts>0||r.bonus_pts>0) roomSummary[rname].present++;
    roomSummary[rname].total += (r.session_pts||0)+(r.bonus_pts||0);
  });

  var totalRoomPts = roomRows.reduce(function(s,r){ return s+(r.session_pts||0)+(r.bonus_pts||0); },0);
  var teamTotalPts = teamMembers.reduce(function(s,m){ return s+(m.points||0); },0);

  var html = '';
  // زرار رجوع
  html += '<button onclick="loadRoomScores()" style="background:none;border:1px solid var(--line);color:var(--mist-dim);padding:8px 14px;border-radius:99px;cursor:pointer;font-size:13px;margin-bottom:16px">← رجوع للفرق</button>';

  // هيدر الفريق
  html += '<div style="text-align:center;padding:20px;background:rgba(200,150,90,0.08);border:1px solid rgba(200,150,90,0.2);border-radius:14px;margin-bottom:16px">';
  html += '<div style="font-size:28px;font-weight:800;color:var(--gold);font-family:var(--font-display)">'+escHtml(teamName)+'</div>';
  html += '<div style="display:flex;justify-content:center;gap:20px;margin-top:12px">';
  html += '<div><div style="font-size:22px;font-weight:800;color:var(--gold)">'+teamTotalPts+'</div><div style="font-size:11px;color:var(--mist-dim)">إجمالي النقاط</div></div>';
  html += '<div><div style="font-size:22px;font-weight:800;color:#a9e6c4">'+teamMembers.length+'</div><div style="font-size:11px;color:var(--mist-dim)">عدد الأعضاء</div></div>';
  html += '<div><div style="font-size:22px;font-weight:800;color:var(--pitch)">'+totalRoomPts+'</div><div style="font-size:11px;color:var(--mist-dim)">نقاط الغرف</div></div>';
  html += '</div></div>';

  // ملخص الغرف
  if(Object.keys(roomSummary).length){
    html += '<div style="font-size:11px;font-weight:700;color:var(--mist-dim);letter-spacing:1px;margin-bottom:10px">🏠 الغرف</div>';
    html += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">';
    Object.values(roomSummary).forEach(function(s){
      html += '<div onclick="showRoomSessionDetail(\''+escHtml(teamName)+'\',\''+escHtml(s.roomName)+'\',\''+s.date+'\')" style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--ink-2);border:1px solid var(--line);border-radius:10px;cursor:pointer;transition:all .2s" onmouseover="this.style.borderColor=\'rgba(200,150,90,.4)\'" onmouseout="this.style.borderColor=\'var(--line)\'">';
      html += '<div><div style="font-size:13px;font-weight:600;color:var(--mist)">'+escHtml(s.roomName)+'</div><div style="font-size:11px;color:var(--mist-dim)">'+escHtml(s.secretary)+' · '+s.date+'</div></div>';
      html += '<div style="display:flex;align-items:center;gap:12px"><div style="text-align:center"><div style="font-size:13px;font-weight:700;color:#a9e6c4">'+s.present+' حضر</div><div style="font-size:12px;color:var(--gold)">'+s.total+' نقطة</div></div><span style="color:var(--gold);opacity:0.6">←</span></div>';
      html += '</div>';
    });
    html += '</div>';
  }

  // قايمة الأعضاء
  html += '<div style="font-size:11px;font-weight:700;color:var(--mist-dim);letter-spacing:1px;margin-bottom:10px">👥 أعضاء الفريق</div>';
  html += '<div style="display:flex;flex-direction:column;gap:6px">';
  teamMembers.sort(function(a,b){ return (b.points||0)-(a.points||0); }).forEach(function(m){
    // حضور الغرف لهذا العضو
    var memberRooms = roomRows.filter(function(r){ return r.member_name===m.name; });
    var roomPresent = memberRooms.filter(function(r){ return r.session_pts>0||r.bonus_pts>0; }).length;

    html += '<div onclick="showMemberDetail(\''+m.id+'\')" style="'+
      'display:flex;align-items:center;justify-content:space-between;'+
      'padding:12px;background:var(--ink-2);border:1px solid var(--line);border-radius:10px;'+
      'cursor:pointer;transition:all .2s" '+
      'onmouseover="this.style.borderColor=\'rgba(200,150,90,.4)\'" '+
      'onmouseout="this.style.borderColor=\'var(--line)\'">';
    html += '<div style="display:flex;align-items:center;gap:10px">';
    html += '<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--gold),var(--coral));display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;color:#fff">'+escHtml((m.name||'?').charAt(0))+'</div>';
    html += '<div><div style="font-size:14px;font-weight:600;color:var(--mist)">'+escHtml(m.name)+'</div>';
    html += '<div style="font-size:11px;color:var(--mist-dim)">حضر '+roomPresent+' غرفة</div></div></div>';
    html += '<div style="display:flex;align-items:center;gap:8px">';
    html += '<span style="font-family:var(--font-display);font-weight:800;font-size:18px;color:var(--gold)">'+(m.points||0)+'</span>';
    html += '<span style="font-size:10px;color:var(--mist-dim)">نقطة</span>';
    html += '<span style="color:var(--gold);opacity:0.6">←</span></div></div>';
  });
  html += '</div>';

  box.innerHTML = html;
}


function showRoomSessionDetail(teamName, secretaryName, sessionDate){
  var box = document.getElementById('roomScoresList');
  if(!box) return;

  // اللي حضروا في الجلسة دي
  var presentRows = _scoresAllData.filter(function(r){
    return r.team_name === teamName
        && (r.room_name||r.secretary_name) === secretaryName
        && r.session_date === sessionDate;
  });

  var presentIds = presentRows.map(function(r){ return r.member_name; });

  // اللي غابوا = أعضاء الفريق اللي مش في presentRows
  var absentRows = teamsMembersCache
    .filter(function(m){ return m.team_name === teamName && m.role === 'member' && presentIds.indexOf(m.name) === -1; })
    .map(function(m){ return { member_name: m.name, session_pts: 0, bonus_pts: 0 }; });

  var rows = presentRows.concat(absentRows);

  var totalPts  = presentRows.reduce(function(s,r){ return s+(r.session_pts||0)+(r.bonus_pts||0); }, 0);
  var totalBonus= presentRows.reduce(function(s,r){ return s+(r.bonus_pts||0); }, 0);
  var present   = presentRows.length;
  var absent    = absentRows.length;

  var html = '';
  // زرار رجوع
  html += '<button onclick="showTeamDetail(\''+escHtml(teamName)+'\')" style="background:none;border:1px solid var(--line);color:var(--mist-dim);padding:8px 14px;border-radius:99px;cursor:pointer;font-size:13px;margin-bottom:16px">← رجوع للفريق</button>';

  // هيدر الجلسة
  html += '<div style="text-align:center;padding:20px;background:rgba(200,150,90,0.08);border:1px solid rgba(200,150,90,0.2);border-radius:14px;margin-bottom:16px">';
  html += '<div style="font-size:18px;font-weight:800;color:var(--gold);font-family:var(--font-display)">🏠 '+escHtml(secretaryName)+'</div>';
  html += '<div style="font-size:12px;color:var(--mist-dim);margin-top:2px">أمين الغرفة: '+escHtml(presentRows.length?presentRows[0].secretary_name||'—':'—')+'</div>';
  html += '<div style="font-size:12px;color:var(--mist-dim);margin-top:4px">'+sessionDate+'</div>';
  html += '<div style="display:flex;justify-content:center;gap:20px;margin-top:12px">';
  html += '<div><div style="font-size:22px;font-weight:800;color:#a9e6c4">'+present+'</div><div style="font-size:11px;color:var(--mist-dim)">حضر</div></div>';
  html += '<div><div style="font-size:22px;font-weight:800;color:#ffb3a6">'+absent+'</div><div style="font-size:11px;color:var(--mist-dim)">غاب</div></div>';
  html += '<div><div style="font-size:22px;font-weight:800;color:var(--gold)">'+totalPts+'</div><div style="font-size:11px;color:var(--mist-dim)">نقطة</div></div>';
  if(totalBonus>0) html += '<div><div style="font-size:22px;font-weight:800;color:var(--gold)">+'+totalBonus+'</div><div style="font-size:11px;color:var(--mist-dim)">بونص</div></div>';
  html += '</div></div>';

  // قايمة الأعضاء
  html += '<div style="display:flex;flex-direction:column;gap:6px">';
  rows.sort(function(a,b){ return ((b.session_pts||0)+(b.bonus_pts||0)) - ((a.session_pts||0)+(a.bonus_pts||0)); });
  rows.forEach(function(r){
    var pts    = (r.session_pts||0)+(r.bonus_pts||0);
    var isPresent = pts > 0;
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--ink-2);border:1px solid var(--line);border-radius:10px">';
    html += '<div style="display:flex;align-items:center;gap:10px">';
    html += '<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--gold),var(--coral));display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;color:#fff">'+escHtml((r.member_name||'?').charAt(0))+'</div>';
    html += '<div style="font-size:14px;font-weight:600;color:var(--mist)">'+escHtml(r.member_name||'—')+'</div></div>';
    html += '<div style="display:flex;align-items:center;gap:8px">';
    if((r.bonus_pts||0)>0) html += '<span style="font-size:11px;color:var(--gold)">+'+r.bonus_pts+' بونص</span>';
    html += '<span style="font-family:var(--font-display);font-weight:800;font-size:16px;color:var(--gold)">'+pts+' نقطة</span>';
    html += '<span style="font-size:12px;padding:3px 8px;border-radius:99px;font-weight:700;'+(isPresent?'background:rgba(74,124,111,.15);color:#a9e6c4':'background:rgba(192,83,58,.12);color:#ffb3a6')+'">'+( isPresent?'✅ حضر':'❌ غاب')+'</span>';
    html += '</div></div>';
  });
  html += '</div>';

  box.innerHTML = html;
}

function showMemberDetail(memberId){
  _scoresView='member_detail';
  _scoresMemberId=memberId;
  var box=document.getElementById('roomScoresList');
  if(!box) return;
  box.innerHTML='<div class="empty-state">بنحمّل تفاصيل العضو...</div>';

  var m = teamsMembersCache.find(function(x){ return x.id===memberId; });
  if(!m){ box.innerHTML='<div class="empty-state">مش لاقي العضو</div>'; return; }

  var extra = window._extraData || {};

  // نقاط الغرف
  var roomRows = _scoresAllData.filter(function(r){ return r.member_name===m.name; });
  var roomTotal = roomRows.reduce(function(s,r){ return s+(r.session_pts||0)+(r.bonus_pts||0); },0);

  // نقاط QR
  var qrRows = (extra.qr||[]).filter(function(r){ return r.member_id===memberId; });
  var qrTotal = qrRows.length * 5; // تقريبي — كل scan بـ 5 نقاط

  // عجلة الحظ
  var wheelRows = (extra.wheel||[]).filter(function(r){ return r.member_id===memberId; });

  // الخلوة
  var retreatRows = (extra.retreat||[]).filter(function(r){ return r.member_id===memberId; });

  // اللغز
  var puzzleRows = (extra.puzzle||[]).filter(function(r){ return r.member_id===memberId; });

  // سؤال اليوم
  var dailyqRows = (extra.dailyq||[]).filter(function(r){ return r.member_id===memberId; });
  var dailyqCorrect = dailyqRows.filter(function(r){ return r.is_correct; }).length;

  // المشروع
  var projectRows = (extra.project||[]).filter(function(r){
    // نشوف لو العضو في مجموعة فيها درجة
    return false; // هنتركها للتطوير
  });

  // الشارات
  var badgeRows = (extra.badge||[]).filter(function(r){ return r.member_id===memberId; });

  var backBtn = _scoresTeam
    ? 'showTeamDetail(\''+escHtml(_scoresTeam)+'\')'
    : 'loadRoomScores()';

  var html = '';
  html += '<button onclick="'+backBtn+'" style="background:none;border:1px solid var(--line);color:var(--mist-dim);padding:8px 14px;border-radius:99px;cursor:pointer;font-size:13px;margin-bottom:16px">← رجوع</button>';

  // هيدر العضو
  html += '<div style="display:flex;align-items:center;gap:14px;padding:16px;background:rgba(200,150,90,0.08);border:1px solid rgba(200,150,90,0.2);border-radius:14px;margin-bottom:16px">';
  html += '<div style="width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,var(--gold),var(--coral));display:flex;align-items:center;justify-content:center;font-weight:800;font-size:22px;color:#fff;flex-shrink:0">'+escHtml((m.name||'?').charAt(0))+'</div>';
  html += '<div><div style="font-size:18px;font-weight:800;color:var(--mist)">'+escHtml(m.name)+'</div>';
  html += '<div style="font-size:12px;color:var(--mist-dim)">@'+escHtml(m.username||'—')+' · فريق '+escHtml(m.team_name||'—')+'</div></div>';
  html += '<div style="margin-right:auto;text-align:center"><div style="font-family:var(--font-display);font-size:28px;font-weight:800;color:var(--gold)">'+(m.points||0)+'</div><div style="font-size:11px;color:var(--mist-dim)">إجمالي النقاط</div></div>';
  html += '</div>';

  // ── بطاقات مصادر النقاط ──
  html += '<div style="display:flex;flex-direction:column;gap:10px">';

  // 1) الغرف
  html += makeSectionCard('🏠 نقاط الغرف', roomTotal, roomRows.length ? scoresTableWrap(
    '<table><thead><tr><th>الأمين</th><th>الجلسة</th><th>بونص</th><th>المجموع</th><th>التاريخ</th></tr></thead><tbody>'+
    roomRows.map(function(r){
      var present=r.session_pts>0||r.bonus_pts>0;
      return '<tr>'+
        '<td style="white-space:nowrap">'+escHtml(r.secretary_name)+'</td>'+
        '<td style="color:var(--gold);font-weight:700">'+(present?r.session_pts:'❌ غاب')+'</td>'+
        '<td style="color:var(--pitch)">'+(r.bonus_pts>0?'+'+r.bonus_pts:'—')+'</td>'+
        '<td style="color:var(--gold);font-weight:800">'+((r.session_pts||0)+(r.bonus_pts||0))+'</td>'+
        '<td style="font-size:11px;color:var(--mist-dim)">'+r.session_date+'</td>'+
        '</tr>';
    }).join('')+
    '</tbody></table>'
  ) : '<div style="font-size:13px;color:var(--mist-dim);padding:8px 0">لسه مسجلش في أي غرفة</div>');

  // 2) QR الحضور
  html += makeSectionCard('📷 QR الحضور', qrRows.length, qrRows.length ? scoresTableWrap(
    '<table><thead><tr><th>النوع</th><th>الوقت</th></tr></thead><tbody>'+
    qrRows.map(function(r){
      var d=new Date(r.scanned_at);
      var t=d.toLocaleDateString('ar-EG')+' '+d.toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
      return '<tr><td>'+(r.scan_type==='book'?'📖 الكتاب':'🗂️ المشروع')+'</td><td style="font-size:11px;color:var(--mist-dim)">'+t+'</td></tr>';
    }).join('')+'</tbody></table>'
  ) : '<div style="font-size:13px;color:var(--mist-dim);padding:8px 0">لسه مسجلش حضور بالـ QR</div>', 'مرة');

  // 3) عجلة الحظ
  html += makeSectionCard('🎡 عجلة الحظ', wheelRows.length, wheelRows.length ? scoresTableWrap(
    '<table><thead><tr><th>الجايزة</th><th>الوقت</th></tr></thead><tbody>'+
    wheelRows.map(function(r){
      var d=new Date(r.spun_at);
      var t=d.toLocaleDateString('ar-EG')+' '+d.toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
      return '<tr><td style="color:var(--gold)">'+escHtml(r.prize_label||r.prize_key||'—')+'</td><td style="font-size:11px;color:var(--mist-dim)">'+t+'</td></tr>';
    }).join('')+'</tbody></table>'
  ) : '<div style="font-size:13px;color:var(--mist-dim);padding:8px 0">لسه ما لفش العجلة</div>', 'لفة');

  // 4) الخلوة
  html += makeSectionCard('🕊️ الخلوة', retreatRows.length, retreatRows.length
    ? '<div style="font-size:13px;color:#a9e6c4;padding:8px 0">✅ حجز '+retreatRows.length+' موعد في الخلوة</div>'
    : '<div style="font-size:13px;color:var(--mist-dim);padding:8px 0">لسه ما حجزش</div>', 'حجز');

  // 5) اللغز
  html += makeSectionCard('🧩 اللغز', puzzleRows.length, puzzleRows.length
    ? '<div style="font-size:13px;color:#a9e6c4;padding:8px 0">✅ حل '+puzzleRows.length+' لغز</div>'
    : '<div style="font-size:13px;color:var(--mist-dim);padding:8px 0">لسه ما حلش لغز</div>', 'لغز');

  // 6) سؤال اليوم
  html += makeSectionCard('❓ سؤال اليوم', dailyqRows.length, dailyqRows.length ? (
    '<div style="font-size:13px;padding:8px 0">'+
    '<span style="color:#a9e6c4">✅ صح: '+dailyqCorrect+'</span> &nbsp;|&nbsp; '+
    '<span style="color:#ffb3a6">❌ غلط: '+(dailyqRows.length-dailyqCorrect)+'</span></div>'
  ) : '<div style="font-size:13px;color:var(--mist-dim);padding:8px 0">لسه ما جاوبش</div>', 'إجابة');

  // 7) الشارات
  html += makeSectionCard('🏅 الشارات', badgeRows.length, badgeRows.length
    ? '<div style="font-size:13px;color:var(--gold);padding:8px 0">🏅 عنده '+badgeRows.length+' شارة</div>'
    : '<div style="font-size:13px;color:var(--mist-dim);padding:8px 0">لسه معندوش شارات</div>', 'شارة');

  html += '</div>';
  box.innerHTML = html;
}

function makeSectionCard(title, value, content, unit){
  unit = unit || 'نقطة';
  return '<div style="background:var(--ink-2);border:1px solid var(--line);border-radius:12px;overflow:hidden">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--line)">'+
      '<div style="font-size:13px;font-weight:700;color:var(--mist)">'+title+'</div>'+
      '<div style="font-family:var(--font-display);font-weight:800;font-size:16px;color:var(--gold)">'+value+' <span style="font-size:11px;color:var(--mist-dim)">'+unit+'</span></div>'+
    '</div>'+
    '<div style="padding:12px 14px">'+content+'</div>'+
  '</div>';
}

async function loadProjectScores(){
  var box=document.getElementById('projectScoresList');
  if(!box) return;
  box.innerHTML='<div class="empty-state">بنحمّل...</div>';
  var res=await supabase.rpc('admin_list_project_scores',{p_password:getAdminPass()});
  if(res.error||!res.data||!res.data.length){ box.innerHTML='<div class="empty-state">لسه مفيش درجات مشروع</div>'; return; }
  var totalScore=res.data.reduce(function(s,r){ return s+(r.score||0); },0);
  box.innerHTML=scoresTableWrap(
    '<table><thead><tr><th>المجموعة</th><th>الفريق</th><th>الدرجة</th><th>ملاحظة</th><th>المصحح</th></tr></thead><tbody>'+
    res.data.map(function(r){
      return '<tr>'+
        '<td style="white-space:nowrap">'+escHtml(r.group_name)+'</td>'+
        '<td style="white-space:nowrap">'+escHtml(r.team_name)+'</td>'+
        '<td style="color:var(--gold);font-weight:700">'+r.score+'</td>'+
        '<td style="font-size:11px;color:var(--mist-dim)">'+escHtml(r.note||'—')+'</td>'+
        '<td style="font-size:11px;white-space:nowrap">'+escHtml(r.reviewer_name)+'</td>'+
        '</tr>';
    }).join('')+
    '<tr style="border-top:2px solid var(--line)"><td colspan="2" style="font-weight:800;color:var(--mist)">الإجمالي</td>'+
    '<td style="color:var(--gold);font-weight:800">'+totalScore+'</td><td colspan="2"></td></tr>'+
    '</tbody></table>'
  );
}
