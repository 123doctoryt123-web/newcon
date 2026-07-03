// ============================================================
// admin.js
// ============================================================
// الثوابت دي بتيجي من supabaseclient.js:
//   window.EDGE_FUNCTION_URL
//   window.SUPABASE_ANON_KEY
//   supabase (الـ client)

function getAdminPass() { return sessionStorage.getItem("adminPass"); }
function setAdminPass(p) { sessionStorage.setItem("adminPass", p); }
function clearAdminPass() { sessionStorage.removeItem("adminPass"); }

function escapeHtml(s) {
  return (s || "").toString().replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

async function tryAdminLogin() {
  var pass = document.getElementById("adminPassInput").value.trim();
  var errBox = document.getElementById("adminErrorMsg");
  var res = await supabase.rpc("admin_check", { p_password: pass });
  if (res.error || !res.data) {
    errBox.textContent = "كلمة السر غير صحيحة";
    errBox.style.display = "block";
    return;
  }
  setAdminPass(pass);
  showPanel();
}

function showPanel() {
  document.getElementById("adminLoginScreen").style.display = "none";
  document.getElementById("adminPanel").style.display = "block";
  loadMembers();
  loadMaterialsAdmin();
  loadMaterialGroupsDropdown();
  loadMatchSettings();
  loadPredictions();
  loadSubmissions();
  loadScanPoints();
  loadAttendanceLog();
}

document.addEventListener("DOMContentLoaded", function () {
  if (getAdminPass()) showPanel();

  document.getElementById("adminLoginBtn").addEventListener("click", tryAdminLogin);
  document.getElementById("adminPassInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") tryAdminLogin();
  });
  document.getElementById("addMemberBtn").addEventListener("click", addMember);
  document.getElementById("printMembersBtn").addEventListener("click", function () { window.print(); });
  document.getElementById("addMaterialBtn").addEventListener("click", addMaterial);
  document.getElementById("saveTeamsBtn").addEventListener("click", saveTeams);
  document.getElementById("toggleLockBtn").addEventListener("click", toggleLock);
  document.getElementById("changePassBtn").addEventListener("click", changePass);
  document.getElementById("adminLogoutBtn").addEventListener("click", function () {
    clearAdminPass();
    location.reload();
  });

  // الإعلانات على الموقع
  var postAnnBtn = document.getElementById("postAnnBtn");
  if (postAnnBtn) postAnnBtn.addEventListener("click", postAnnouncement);
  var clearAnnBtn = document.getElementById("clearAnnBtn");
  if (clearAnnBtn) clearAnnBtn.addEventListener("click", clearAnnouncement);
  loadCurrentAnnouncement();

  // الإشعارات
  var sendBtn = document.getElementById("sendNotifBtn");
  var alarmBtn = document.getElementById("sendAlarmBtn");
  if (sendBtn) sendBtn.addEventListener("click", function () { sendNotification(false); });
  if (alarmBtn) alarmBtn.addEventListener("click", function () { sendNotification(true); });

  // إعدادات النقاط
  var savePointsBtn = document.getElementById("saveScanPointsBtn");
  if (savePointsBtn) savePointsBtn.addEventListener("click", saveScanPoints);

  // تبويبات
  document.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
      document.querySelectorAll(".tab-panel").forEach(function (p) { p.classList.remove("active"); });
      tab.classList.add("active");
      document.getElementById("panel-" + tab.dataset.tab).classList.add("active");
    });
  });
});

// ============================================================
// الشباب
// ============================================================
async function loadMembers() {
  var res = await supabase.rpc("admin_list_members", { p_password: getAdminPass() });
  var tbody = document.querySelector("#membersTable tbody");
  var members = res.data || [];
  document.getElementById("memberCount").textContent = members.length;
  tbody.innerHTML = members.map(function (m) {
    return '<tr>' +
      '<td>' + escapeHtml(m.name) + '</td>' +
      '<td>' + escapeHtml(m.username) + '</td>' +
      '<td id="pass-' + m.id + '">' + escapeHtml(m.password) + '</td>' +
      '<td class="no-print" style="display:flex;gap:4px;flex-wrap:wrap">' +
        '<button class="btn danger small" data-id="' + m.id + '" onclick="deleteMember(this)">حذف</button>' +
        '<button class="btn outline small" data-id="' + m.id + '" onclick="resetMemberPass(this)">ريست</button>' +
      '</td>' +
      '</tr>';
  }).join("") || '<tr><td colspan="3">لسه مفيش شباب</td></tr>';
}

async function addMember() {
  var name = document.getElementById("newMemberName").value.trim();
  var resBox = document.getElementById("newMemberResult");
  if (!name) return;
  var btn = document.getElementById("addMemberBtn");
  btn.disabled = true; btn.textContent = "بنضيف...";
  var r = await supabase.rpc("admin_add_member", { p_password: getAdminPass(), p_name: name });
  btn.disabled = false; btn.textContent = "إضافة وتوليد بيانات الدخول";
  if (r.error || !r.data || r.data.length === 0) {
    resBox.innerHTML = '<div class="error-msg" style="display:block">حصل خطأ، حاول تاني</div>';
    return;
  }
  var d = r.data[0];
  resBox.innerHTML = '<div class="success-msg" style="display:block">✅ تم الإضافة — اليوزر: <strong>' + escapeHtml(d.out_username) + '</strong> — الباسورد: <strong>' + escapeHtml(d.out_password) + '</strong></div>';
  document.getElementById("newMemberName").value = "";
  loadMembers();
  if (typeof loadTeamsAdmin === "function") loadTeamsAdmin();
}

async function deleteMember(btn) {
  if (!confirm("هتحذف الشاب ده؟")) return;
  await supabase.rpc("admin_delete_member", { p_password: getAdminPass(), p_id: btn.dataset.id });
  loadMembers();
  if (typeof loadTeamsAdmin === "function") loadTeamsAdmin();
}

async function resetMemberPass(btn) {
  if (!confirm("هيتولّد باسورد جديد لهذا الشاب. متابع؟")) return;
  var res = await supabase.rpc("admin_reset_member_password", {
    p_password: getAdminPass(),
    p_member_id: btn.dataset.id,
  });
  if (res.error || !res.data || !res.data.length) {
    alert("حصل خطأ أثناء ريست الباسورد");
    return;
  }
  var newPass = res.data[0].new_password;  // الدالة بترجع TABLE مش scalar
  alert("✅ الباسورد الجديد: " + newPass + "\nاحتفظ بيه وابعته للشاب");
}

// ============================================================
// المواد
// ============================================================
async function loadMaterialsAdmin() {
  var res = await supabase.rpc("admin_list_materials", { p_password: getAdminPass() });
  if (res.error) {
    // fallback to direct query if function not yet created
    res = await supabase.from("materials").select("*").order("created_at", { ascending: false });
  }
  var box = document.getElementById("materialsAdminList");
  var items = res.data || [];
  if (items.length === 0) { box.innerHTML = '<div style="color:var(--mist-dim)">لسه مفيش مواد</div>'; return; }
  box.innerHTML = items.map(function (m) {
    var link = m.url ? '<a href="' + escapeHtml(m.url) + '" target="_blank" style="font-size:12px">فتح الرابط</a>' : '';
    var groupLabel = m.group_name
      ? '<span style="font-size:11px;background:var(--ink-3);padding:2px 7px;border-radius:20px;color:var(--gold)">👥 ' + escapeHtml(m.group_name) + '</span>'
      : '<span style="font-size:11px;background:var(--ink-3);padding:2px 7px;border-radius:20px;color:var(--mist-dim)">🌐 للكل</span>';
    return '<div class="submission-item"><div><strong>' + escapeHtml(m.title) + '</strong> <span style="font-size:11px;color:var(--mist-dim)">[' + escapeHtml(m.type) + ']</span> ' + groupLabel + ' ' + link +
      (m.description ? '<div style="font-size:12px;color:var(--mist-dim)">' + escapeHtml(m.description) + '</div>' : '') +
      '</div><button class="btn danger small" data-id="' + m.id + '" onclick="deleteMaterial(this)">حذف</button></div>';
  }).join("");
}

async function addMaterial() {
  var title = document.getElementById("matTitle").value.trim();
  var type = document.getElementById("matType").value;
  var url = document.getElementById("matUrl").value.trim();
  var desc = document.getElementById("matDesc").value.trim();
  var content = document.getElementById("matContent").value.trim();
  var matGroupEl = document.getElementById("matGroup");
  var groupVal = matGroupEl ? matGroupEl.value : "";
  if (!title) return;
  var btn = document.getElementById("addMaterialBtn");
  btn.disabled = true; btn.textContent = "بنضيف...";
  await supabase.rpc("admin_add_material", {
    p_password: getAdminPass(), p_title: title, p_description: desc,
    p_type: type, p_url: url || null, p_content: content || null,
    p_group_id: groupVal ? groupVal : null,   // uuid — لا نحوّله لـ int
  });
  btn.disabled = false; btn.textContent = "إضافة المادة";
  ["matTitle", "matUrl", "matDesc", "matContent"].forEach(function (id) { document.getElementById(id).value = ""; });
  if (matGroupEl) matGroupEl.value = "";
  loadMaterialsAdmin();
}

async function loadMaterialGroupsDropdown() {
  var res = await supabase.rpc("admin_list_project_groups", { p_password: getAdminPass() });
  if (res.error || !res.data) return;
  var sel = document.getElementById("matGroup");
  if (!sel) return;
  var seen = {};
  res.data.forEach(function(r) {
    if (!seen[r.group_id]) {
      seen[r.group_id] = r.group_name;
      var opt = document.createElement("option");
      opt.value = r.group_id;
      opt.textContent = "👥 " + r.group_name;
      sel.appendChild(opt);
    }
  });
}

async function deleteMaterial(btn) {
  if (!confirm("هتحذف المادة دي؟")) return;
  await supabase.rpc("admin_delete_material", { p_password: getAdminPass(), p_id: btn.dataset.id });
  loadMaterialsAdmin();
}

// ============================================================
// التوقعات
// ============================================================
var isLocked = false;

async function loadMatchSettings() {
  var res = await supabase.rpc("get_match_info");
  if (res.error || !res.data || res.data.length === 0) return;
  var d = res.data[0];
  document.getElementById("team1Input").value = d.team1 || "";
  document.getElementById("team2Input").value = d.team2 || "";
  isLocked = d.locked;
  updateLockUI();
}

function updateLockUI() {
  document.getElementById("lockStatusText").textContent = "حالة التوقعات: " + (isLocked ? "🔒 مقفولة" : "🔓 مفتوحة");
  document.getElementById("toggleLockBtn").textContent = isLocked ? "افتح التوقعات" : "قفل التوقعات";
}

async function saveTeams() {
  var t1 = document.getElementById("team1Input").value.trim();
  var t2 = document.getElementById("team2Input").value.trim();
  if (!t1 || !t2) return;
  await supabase.rpc("admin_set_teams", { p_password: getAdminPass(), p_team1: t1, p_team2: t2 });
  alert("تم حفظ أسماء الفريقين ✅");
}

async function toggleLock() {
  isLocked = !isLocked;
  await supabase.rpc("admin_set_lock", { p_password: getAdminPass(), p_locked: isLocked });
  updateLockUI();
}

async function loadPredictions() {
  var res = await supabase.rpc("admin_list_predictions", { p_password: getAdminPass() });
  var tbody = document.getElementById("predTableBody");
  var items = res.data || [];
  document.getElementById("predCount").textContent = items.length;
  tbody.innerHTML = items.map(function (p) {
    var d = new Date(p.updated_at);
    var ds = d.toLocaleDateString("ar-EG") + " " + d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    return '<tr><td>' + escapeHtml(p.name) + '</td><td>' + escapeHtml(p.username) + '</td><td>' + p.score1 + ' - ' + p.score2 + '</td><td>' + ds + '</td></tr>';
  }).join("") || '<tr><td colspan="4">لسه مفيش توقعات</td></tr>';
}

// ============================================================
// المشاركات
// ============================================================
async function loadSubmissions() {
  var res = await supabase.rpc("admin_list_submissions", { p_password: getAdminPass() });
  var tbody = document.getElementById("subTableBody");
  var items = res.data || [];
  document.getElementById("subCount").textContent = items.length;
  tbody.innerHTML = items.map(function (s) {
    return '<tr><td>' + escapeHtml(s.name) + '</td><td>' + escapeHtml(s.type) + '</td><td><a href="' + escapeHtml(s.link) + '" target="_blank">فتح</a></td><td>' + escapeHtml(s.note || "—") + '</td></tr>';
  }).join("") || '<tr><td colspan="4">لسه مفيش مشاركات</td></tr>';
}

// ============================================================
// QR — النقاط والسجل
// ============================================================
async function loadScanPoints() {
  var res = await supabase.rpc("get_scan_points");
  if (res.error || !res.data || !res.data.length) return;
  var el1 = document.getElementById("bookScanPts");
  var el2 = document.getElementById("projectScanPts");
  if (el1) el1.value = res.data[0].book_pts;
  if (el2) el2.value = res.data[0].project_pts;
}

async function saveScanPoints() {
  var bookPts = parseInt(document.getElementById("bookScanPts").value) || 5;
  var projPts = parseInt(document.getElementById("projectScanPts").value) || 10;
  var msg = document.getElementById("scanPointsMsg");
  await supabase.rpc("admin_set_scan_points", {
    p_password: getAdminPass(),
    p_book_pts: bookPts,
    p_project_pts: projPts,
  });
  msg.innerHTML = '<div class="success-msg" style="display:block">✅ تم حفظ النقاط</div>';
  setTimeout(function () { msg.innerHTML = ""; }, 2500);
}

async function loadAttendanceLog() {
  var res = await supabase.rpc("admin_list_attendance", { p_password: getAdminPass() });
  var box = document.getElementById("attendanceLog");
  if (!box) return;
  var items = res.data || [];
  if (!items.length) { box.innerHTML = '<div class="empty-state">لسه مفيش حضور مسجّل</div>'; return; }
  box.innerHTML = items.map(function (a) {
    var d = new Date(a.scanned_at);
    var label = a.scan_type === "book" ? "📖 الكتاب" : "🗂️ المشروع";
    var ds = d.toLocaleDateString("ar-EG") + " " + d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    return '<div class="submission-item"><div><strong>' + escapeHtml(a.member_name) + '</strong> — ' + label + '</div><div style="color:var(--mist-dim);font-size:12px">' + ds + '</div></div>';
  }).join("");
}

// ============================================================
// الإشعارات — بترسل عبر Edge Function
// ============================================================
async function sendNotification(isAlarm) {
  var title = document.getElementById("notifTitle").value.trim();
  var body = document.getElementById("notifBody").value.trim();
  var msg = document.getElementById("notifMsg");
  if (!title || !body) {
    msg.innerHTML = '<div class="error-msg" style="display:block">اكتب العنوان والنص الأول</div>';
    return;
  }
  var btn = isAlarm ? document.getElementById("sendAlarmBtn") : document.getElementById("sendNotifBtn");
  btn.disabled = true; btn.textContent = "بنبعت...";

  try {
    await supabase.rpc("admin_save_announcement", {
      p_password: getAdminPass(),
      p_title:    title,
      p_body:     body,
    });

    var res = await fetch(window.EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": window.SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + window.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        action: "send_notification",
        title: title,
        body: body,
        alarm: isAlarm,
      }),
    });
    var data = await res.json();
    if (data.ok) {
      msg.innerHTML = '<div class="success-msg" style="display:block">✅ تم الإرسال لـ ' + (data.sent || 0) + ' جهاز' + (data.failed ? ' (فشل ' + data.failed + ')' : '') + '</div>';
    } else {
      msg.innerHTML = '<div class="error-msg" style="display:block">خطأ: ' + escapeHtml(data.error || "غير معروف") + '</div>';
    }
  } catch (e) {
    msg.innerHTML = '<div class="error-msg" style="display:block">تعذّر الاتصال بالسيرفر</div>';
  }

  btn.disabled = false;
  btn.textContent = isAlarm ? "⏰ إرسال منبه (بصوت عالي)" : "🔔 إرسال إشعار";
  setTimeout(function () { msg.innerHTML = ""; }, 5000);
}

// ============================================================
// الإعدادات
// ============================================================
async function changePass() {
  var newPass = document.getElementById("newAdminPass").value.trim();
  var msg = document.getElementById("settingsMsg");
  if (!newPass) { msg.innerHTML = '<div class="error-msg" style="display:block">اكتب كلمة السر الجديدة</div>'; return; }
  await supabase.rpc("admin_change_password", { p_password: getAdminPass(), p_new_password: newPass });
  setAdminPass(newPass);
  document.getElementById("newAdminPass").value = "";
  msg.innerHTML = '<div class="success-msg" style="display:block">✅ تم تغيير كلمة السر</div>';
  setTimeout(function () { msg.innerHTML = ""; }, 3000);
}

// ============================================================
// إدارة الإعلانات على الموقع
// ============================================================
async function loadCurrentAnnouncement() {
  var card = document.getElementById("currentAnnCard");
  var preview = document.getElementById("currentAnnPreview");
  if (!card || !preview) return;

  var res = await supabase.rpc("get_latest_announcement");
  if (res.error || !res.data || res.data.length === 0) {
    card.style.display = "none";
    return;
  }
  var ann = res.data[0];
  var d = new Date(ann.created_at);
  var timeStr = d.toLocaleString("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  preview.innerHTML =
    '<div style="font-weight:700;color:var(--gold);margin-bottom:5px">' + escapeHtml(ann.title) + '</div>' +
    '<div style="font-size:13px;color:var(--mist)">' + escapeHtml(ann.body) + '</div>' +
    '<div style="font-size:11px;color:var(--mist-dim);margin-top:6px">⏰ ' + timeStr + '</div>';
  card.setAttribute("data-ann-id", ann.id);
  card.style.display = "block";
}

async function postAnnouncement() {
  var title = document.getElementById("annTitle").value.trim();
  var body  = document.getElementById("annBody").value.trim();
  var msg   = document.getElementById("annMsg");
  var btn   = document.getElementById("postAnnBtn");

  if (!title || !body) {
    msg.innerHTML = '<div class="error-msg" style="display:block">اكتب العنوان والنص الأول</div>';
    return;
  }
  btn.disabled = true; btn.textContent = "بننشر...";

  var res = await supabase.rpc("admin_save_announcement", {
    p_password: getAdminPass(),
    p_title: title,
    p_body: body,
  });

  btn.disabled = false; btn.textContent = "📌 نشر على الموقع";

  if (res.error) {
    msg.innerHTML = '<div class="error-msg" style="display:block">خطأ: ' + escapeHtml(res.error.message) + '</div>';
    return;
  }

  msg.innerHTML = '<div class="success-msg" style="display:block">✅ تم النشر — هيظهر للشباب فور ما يفتحوا الداشبورد</div>';
  document.getElementById("annTitle").value = "";
  document.getElementById("annBody").value  = "";
  setTimeout(function () { msg.innerHTML = ""; }, 5000);
  loadCurrentAnnouncement();
}

async function clearAnnouncement() {
  var card = document.getElementById("currentAnnCard");
  var annId = card ? card.getAttribute("data-ann-id") : null;
  if (!annId) return;

  var btn = document.getElementById("clearAnnBtn");
  btn.disabled = true; btn.textContent = "بنمسح...";

  var res = await supabase.rpc("admin_delete_announcement", {
    p_password: getAdminPass(),
    p_id: parseInt(annId),
  });

  btn.disabled = false; btn.textContent = "🗑️ مسح الإعلان من الموقع";

  if (!res.error) {
    card.style.display = "none";
  }
}
