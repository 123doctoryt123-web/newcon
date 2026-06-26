// ============================================================
// adminextra.js — الفرق، البرنامج، الجاسوس، درس الكتاب
// ============================================================
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
});

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
