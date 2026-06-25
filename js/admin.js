// ============================================================
// admin.js
// ============================================================
function getAdminPass(){ return sessionStorage.getItem("adminPass"); }
function setAdminPass(p){ sessionStorage.setItem("adminPass", p); }
function clearAdminPass(){ sessionStorage.removeItem("adminPass"); }

function escapeHtml(s){
  return (s||"").toString().replace(/[&<>"']/g,function(c){
    return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  });
}

async function tryAdminLogin(){
  var pass=document.getElementById("adminPassInput").value.trim();
  var errBox=document.getElementById("adminErrorMsg");
  var res=await supabase.rpc("admin_check",{p_password:pass});
  if(res.error||!res.data){ errBox.textContent="كلمة السر غير صحيحة"; errBox.style.display="block"; return; }
  setAdminPass(pass); showPanel();
}

function showPanel(){
  document.getElementById("adminLoginScreen").style.display="none";
  document.getElementById("adminPanel").style.display="block";
  loadMembers(); loadMaterialsAdmin(); loadMatchSettings(); loadPredictions(); loadSubmissions();
}

document.addEventListener("DOMContentLoaded",function(){
  if(getAdminPass()) showPanel();
  document.getElementById("adminLoginBtn").addEventListener("click",tryAdminLogin);
  document.getElementById("adminPassInput").addEventListener("keydown",function(e){ if(e.key==="Enter") tryAdminLogin(); });
  document.getElementById("addMemberBtn").addEventListener("click",addMember);
  document.getElementById("printMembersBtn").addEventListener("click",function(){ window.print(); });
  document.getElementById("addMaterialBtn").addEventListener("click",addMaterial);
  document.getElementById("saveTeamsBtn").addEventListener("click",saveTeams);
  document.getElementById("toggleLockBtn").addEventListener("click",toggleLock);
  document.getElementById("changePassBtn").addEventListener("click",changePass);
  document.getElementById("adminLogoutBtn").addEventListener("click",function(){ clearAdminPass(); location.reload(); });

  // الإشعارات
  var sendBtn=document.getElementById("sendNotifBtn");
  var alarmBtn=document.getElementById("sendAlarmBtn");
  if(sendBtn)  sendBtn.addEventListener("click",function(){ sendNotification(false); });
  if(alarmBtn) alarmBtn.addEventListener("click",function(){ sendNotification(true); });

  // تبويبات
  document.querySelectorAll(".tab").forEach(function(tab){
    tab.addEventListener("click",function(){
      document.querySelectorAll(".tab").forEach(function(t){ t.classList.remove("active"); });
      document.querySelectorAll(".tab-panel").forEach(function(p){ p.classList.remove("active"); });
      tab.classList.add("active");
      document.getElementById("panel-"+tab.dataset.tab).classList.add("active");
    });
  });
});

// الشباب
async function loadMembers(){
  var res=await supabase.rpc("admin_list_members",{p_password:getAdminPass()});
  var tbody=document.querySelector("#membersTable tbody");
  var members=res.data||[];
  document.getElementById("memberCount").textContent=members.length;
  tbody.innerHTML=members.map(function(m){
    return'<tr><td>'+escapeHtml(m.name)+'</td><td>'+escapeHtml(m.username)+'</td><td>'+escapeHtml(m.password)+'</td>'+
      '<td class="no-print"><button class="btn danger small" data-id="'+m.id+'" onclick="deleteMember(this)">حذف</button></td></tr>';
  }).join("")||'<tr><td colspan="4">لسه مفيش شباب</td></tr>';
}

async function addMember(){
  var name=document.getElementById("newMemberName").value.trim();
  var resBox=document.getElementById("newMemberResult");
  if(!name) return;
  var btn=document.getElementById("addMemberBtn");
  btn.disabled=true; btn.textContent="بنضيف...";
  var r=await supabase.rpc("admin_add_member",{p_password:getAdminPass(),p_name:name});
  btn.disabled=false; btn.textContent="إضافة وتوليد بيانات الدخول";
  if(r.error||!r.data||r.data.length===0){ resBox.innerHTML='<div class="error-msg" style="display:block">حصل خطأ، حاول تاني</div>'; return; }
  var d=r.data[0];
  resBox.innerHTML='<div class="success-msg" style="display:block">✅ تم الإضافة — اليوزر: <strong>'+escapeHtml(d.out_username)+'</strong> — الباسورد: <strong>'+escapeHtml(d.out_password)+'</strong></div>';
  document.getElementById("newMemberName").value="";
  loadMembers(); loadTeamsAdmin();
}

async function deleteMember(btn){
  if(!confirm("هتحذف الشاب ده؟")) return;
  await supabase.rpc("admin_delete_member",{p_password:getAdminPass(),p_id:btn.dataset.id});
  loadMembers(); loadTeamsAdmin();
}

// المواد
async function loadMaterialsAdmin(){
  var res=await supabase.from("materials").select("*").order("created_at",{ascending:false});
  var box=document.getElementById("materialsAdminList");
  var items=res.data||[];
  if(items.length===0){ box.innerHTML='<div style="color:var(--mist-dim)">لسه مفيش مواد</div>'; return; }
  box.innerHTML=items.map(function(m){
    var link=m.url?'<a href="'+escapeHtml(m.url)+'" target="_blank" style="font-size:12px">فتح الرابط</a>':'';
    return'<div class="submission-item"><div><strong>'+escapeHtml(m.title)+'</strong> <span style="font-size:11px;color:var(--mist-dim)">['+escapeHtml(m.type)+']</span> '+link+
      (m.description?'<div style="font-size:12px;color:var(--mist-dim)">'+escapeHtml(m.description)+'</div>':'')+
      '</div><button class="btn danger small" data-id="'+m.id+'" onclick="deleteMaterial(this)">حذف</button></div>';
  }).join("");
}

async function addMaterial(){
  var title=document.getElementById("matTitle").value.trim();
  var type=document.getElementById("matType").value;
  var url=document.getElementById("matUrl").value.trim();
  var desc=document.getElementById("matDesc").value.trim();
  var content=document.getElementById("matContent").value.trim();
  if(!title) return;
  var btn=document.getElementById("addMaterialBtn");
  btn.disabled=true; btn.textContent="بنضيف...";
  await supabase.rpc("admin_add_material",{p_password:getAdminPass(),p_title:title,p_description:desc,p_type:type,p_url:url||null,p_content:content||null});
  btn.disabled=false; btn.textContent="إضافة المادة";
  document.getElementById("matTitle").value=""; document.getElementById("matUrl").value="";
  document.getElementById("matDesc").value=""; document.getElementById("matContent").value="";
  loadMaterialsAdmin();
}

async function deleteMaterial(btn){
  if(!confirm("هتحذف المادة دي؟")) return;
  await supabase.rpc("admin_delete_material",{p_password:getAdminPass(),p_id:btn.dataset.id});
  loadMaterialsAdmin();
}

// التوقعات
var isLocked=false;
async function loadMatchSettings(){
  var res=await supabase.rpc("get_match_info");
  if(res.error||!res.data||res.data.length===0) return;
  var d=res.data[0];
  document.getElementById("team1Input").value=d.team1||"";
  document.getElementById("team2Input").value=d.team2||"";
  isLocked=d.locked; updateLockUI();
}
function updateLockUI(){
  document.getElementById("lockStatusText").textContent="حالة التوقعات: "+(isLocked?"🔒 مقفولة":"🔓 مفتوحة");
  document.getElementById("toggleLockBtn").textContent=isLocked?"افتح التوقعات":"قفل التوقعات";
}
async function saveTeams(){
  var t1=document.getElementById("team1Input").value.trim();
  var t2=document.getElementById("team2Input").value.trim();
  if(!t1||!t2) return;
  await supabase.rpc("admin_set_teams",{p_password:getAdminPass(),p_team1:t1,p_team2:t2});
  alert("تم حفظ أسماء الفريقين ✅");
}
async function toggleLock(){
  isLocked=!isLocked;
  await supabase.rpc("admin_set_lock",{p_password:getAdminPass(),p_locked:isLocked});
  updateLockUI();
}
async function loadPredictions(){
  var res=await supabase.rpc("admin_list_predictions",{p_password:getAdminPass()});
  var tbody=document.getElementById("predTableBody");
  var items=res.data||[];
  document.getElementById("predCount").textContent=items.length;
  tbody.innerHTML=items.map(function(p){
    var d=new Date(p.updated_at);
    var ds=d.toLocaleDateString("ar-EG")+" "+d.toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"});
    return'<tr><td>'+escapeHtml(p.name)+'</td><td>'+escapeHtml(p.username)+'</td><td>'+p.score1+' - '+p.score2+'</td><td>'+ds+'</td></tr>';
  }).join("")||'<tr><td colspan="4">لسه مفيش توقعات</td></tr>';
}

// المشاركات
async function loadSubmissions(){
  var res=await supabase.rpc("admin_list_submissions",{p_password:getAdminPass()});
  var tbody=document.getElementById("subTableBody");
  var items=res.data||[];
  document.getElementById("subCount").textContent=items.length;
  tbody.innerHTML=items.map(function(s){
    return'<tr><td>'+escapeHtml(s.name)+'</td><td>'+escapeHtml(s.type)+'</td><td><a href="'+escapeHtml(s.link)+'" target="_blank">فتح</a></td><td>'+escapeHtml(s.note||"—")+'</td></tr>';
  }).join("")||'<tr><td colspan="4">لسه مفيش مشاركات</td></tr>';
}

// الإعدادات
async function changePass(){
  var newPass=document.getElementById("newAdminPass").value.trim();
  var msg=document.getElementById("settingsMsg");
  if(!newPass){ msg.innerHTML='<div class="error-msg" style="display:block">اكتب كلمة السر الجديدة</div>'; return; }
  await supabase.rpc("admin_change_password",{p_password:getAdminPass(),p_new_password:newPass});
  setAdminPass(newPass);
  document.getElementById("newAdminPass").value="";
  msg.innerHTML='<div class="success-msg" style="display:block">✅ تم تغيير كلمة السر</div>';
  setTimeout(function(){ msg.innerHTML=""; },3000);
}

// الإشعارات
async function sendNotification(isAlarm){
  var title=document.getElementById("notifTitle").value.trim();
  var body=document.getElementById("notifBody").value.trim();
  var msg=document.getElementById("notifMsg");
  if(!title||!body){ msg.innerHTML='<div class="error-msg" style="display:block">اكتب العنوان والنص الأول</div>'; return; }
  var btn=isAlarm?document.getElementById("sendAlarmBtn"):document.getElementById("sendNotifBtn");
  btn.disabled=true; btn.textContent="بنبعت...";
  var subsRes=await supabase.rpc("get_all_push_subscriptions",{p_password:getAdminPass()});
  btn.disabled=false; btn.textContent=isAlarm?"⏰ إرسال منبه (بصوت عالي)":"🔔 إرسال إشعار";
  if(subsRes.error||!subsRes.data||subsRes.data.length===0){
    msg.innerHTML='<div class="error-msg" style="display:block">مفيش شباب مشتركين في الإشعارات لسه</div>'; return;
  }
  msg.innerHTML='<div class="success-msg" style="display:block">✅ تم الإرسال لـ '+subsRes.data.length+' شاب</div>';
  setTimeout(function(){ msg.innerHTML=""; },4000);
}
