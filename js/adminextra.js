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
  document.getElementById("saveFormBtn").addEventListener("click",saveFormUrl);
  loadTeamsAdmin();
  loadProgramAdmin();
  loadFormUrl();

  // القادة والمشاريع — listeners بس، التحميل هيحصل لما التاب ينفتح
  var setLeaderBtn = document.getElementById('setLeaderBtn');
  if(setLeaderBtn) setLeaderBtn.addEventListener('click', setMemberRole);
  var createGroupBtn = document.getElementById('createGroupBtn');
  if(createGroupBtn) createGroupBtn.addEventListener('click', createProjectGroup);
});

// تحميل بيانات القادة لما تاب "leaders" ينفتح
(function watchLeadersTab(){
  var panel = document.getElementById('panel-leaders');
  if(!panel) return;
  var loaded = false;
  var observer = new MutationObserver(function(){
    if(panel.classList.contains('active') && !loaded){
      loaded = true;
      loadLeadersAdmin();
      loadProjectGroups();
    }
    // لو اتأغلق التاب نرجع نسمح بالتحديث المرة الجاية
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
  var select=document.getElementById("teamMemberSelect");
  select.innerHTML=teamsMembersCache.map(function(m){
    return'<option value="'+m.id+'">'+escHtml(m.name)+'</option>';
  }).join("")||'<option value="">لسه مفيش شباب</option>';
  fillTeamInputsFromSelection();
  renderTeamsTable();
  renderSpyMembers();
}

function fillTeamInputsFromSelection(){
  var id=document.getElementById("teamMemberSelect").value;
  var m=teamsMembersCache.find(function(x){ return x.id===id; });
  document.getElementById("teamNameInput").value=m?(m.team_name||""):"";
  document.getElementById("teamPointsInput").value=m?(m.points||0):0;
}

function renderTeamsTable(){
  var tbody=document.getElementById("teamsTableBody");
  tbody.innerHTML=teamsMembersCache.map(function(m){
    return'<tr><td>'+escHtml(m.name)+'</td><td>'+escHtml(m.team_name||"—")+'</td><td>'+(m.points||0)+'</td></tr>';
  }).join("")||'<tr><td colspan="3">لسه مفيش شباب</td></tr>';
}

async function saveMemberTeam(){
  var id=document.getElementById("teamMemberSelect").value;
  if(!id) return;
  var team=document.getElementById("teamNameInput").value.trim();
  var points=parseInt(document.getElementById("teamPointsInput").value)||0;
  var msg=document.getElementById("teamStatsMsg");
  var btn=document.getElementById("saveTeamStatsBtn");
  btn.disabled=true; btn.textContent="بنحفظ...";
  var res=await supabase.rpc("admin_set_member_team",{p_password:getAdminPass(),p_member_id:id,p_team_name:team,p_points:points});
  btn.disabled=false; btn.textContent="حفظ التعديلات";
  if(res.error){ msg.innerHTML='<div class="error-msg" style="display:block">حصل خطأ، حاول تاني</div>'; return; }
  msg.innerHTML='<div class="success-msg" style="display:block">تم الحفظ ✅</div>';
  setTimeout(function(){ msg.innerHTML=""; },2500);
  loadTeamsAdmin();
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
async function loadFormUrl(){
  var res=await supabase.rpc("get_form_url");
  if(res.data) document.getElementById("formUrl").value=res.data;
}

async function saveFormUrl(){
  var url=document.getElementById("formUrl").value.trim();
  var msg=document.getElementById("formMsg");
  var btn=document.getElementById("saveFormBtn");
  btn.disabled=true; btn.textContent="بنحفظ...";
  await supabase.rpc("admin_set_form_url",{p_password:getAdminPass(),p_url:url});
  btn.disabled=false; btn.textContent="حفظ الرابط";
  msg.innerHTML='<div class="success-msg" style="display:block">✅ تم حفظ الرابط</div>';
  setTimeout(function(){ msg.innerHTML=""; },3000);
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
      leader: '<span style="color:var(--gold);font-weight:700">👑 قائد</span>',
      member: '<span style="color:var(--mist-dim)">عضو</span>'
    };
    tbody.innerHTML = leadersMembersCache.map(function(m){
      return '<tr>' +
        '<td>' + escHtml(m.name) + '</td>' +
        '<td>' + escHtml(m.team_name||'—') + '</td>' +
        '<td>' + (roleLabel[m.role] || '<span style="color:var(--mist-dim)">عضو</span>') + '</td>' +
        '<td>' + (m.points||0) + '</td>' +
        '</tr>';
    }).join('');
  }

  // ملأ اختيار أعضاء المجموعة
  renderGroupMembersCheckList();
}

async function setMemberRole(){
  var memberId = document.getElementById('leaderMemberSelect').value;
  var role     = document.getElementById('leaderRoleSelect').value;
  var msg      = document.getElementById('leaderMsg');
  if(!memberId){ msg.innerHTML = '<div class="error-msg" style="display:block">اختار شاب الأول</div>'; return; }
  var btn = document.getElementById('setLeaderBtn');
  btn.disabled = true; btn.textContent = 'بنحفظ...';
  var res = await supabase.rpc('admin_set_member_role', {p_password: getAdminPass(), p_member_id: memberId, p_role: role});
  btn.disabled = false; btn.textContent = 'حفظ الدور';
  if(res.error){
    msg.innerHTML = '<div class="error-msg" style="display:block">❌ حصل خطأ: ' + escHtml(res.error.message) + '</div>';
    return;
  }
  var label = role === 'leader' ? '👑 قائد فريق' : 'عضو عادي';
  msg.innerHTML = '<div class="success-msg" style="display:block">✅ تم تعيينه كـ ' + label + '</div>';
  setTimeout(function(){ msg.innerHTML = ''; }, 3000);
  loadLeadersAdmin();
}

// ============================================================
// مجموعات المشاريع
// ============================================================
function renderGroupMembersCheckList(){
  var box = document.getElementById('groupMembersCheckList');
  if(!box) return;
  if(!leadersMembersCache.length){
    box.innerHTML = '<span style="color:var(--mist-dim);font-size:13px">لسه مفيش شباب</span>';
    return;
  }
  box.innerHTML = leadersMembersCache.map(function(m){
    var selected = groupSelectedIds.has(m.id);
    return '<button class="btn small ' + (selected ? '' : 'outline') + ' grp-member-btn" data-id="' + m.id + '" style="margin:2px">' +
      (selected ? '✅ ' : '') + escHtml(m.name) +
      '<small style="opacity:.6;font-size:10px"> ' + escHtml(m.team_name||'') + '</small>' +
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
}

async function createProjectGroup(){
  var name    = document.getElementById('groupNameInput').value.trim();
  var ids     = Array.from(groupSelectedIds);
  var msg     = document.getElementById('groupMsg');
  if(!name){ msg.innerHTML = '<div class="error-msg" style="display:block">اكتب اسم المجموعة الأول</div>'; return; }
  if(ids.length < 2 || ids.length > 5){
    msg.innerHTML = '<div class="error-msg" style="display:block">لازم تختار من 2 لـ 5 أعضاء</div>'; return;
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
