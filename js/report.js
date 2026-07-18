// ============================================================
// report.js — صفحة متابعة للقراءة فقط (بدون أي تعديل)
// ============================================================

function getViewerPass() { return sessionStorage.getItem("viewerPass"); }
function setViewerPass(p) { sessionStorage.setItem("viewerPass", p); }
function clearViewerPass() { sessionStorage.removeItem("viewerPass"); }

function escapeHtml(s) {
  return (s || "").toString().replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

var allMembers = [];
var allAttendance = [];

async function tryViewerLogin() {
  var pass = document.getElementById("viewerPassInput").value.trim();
  var errBox = document.getElementById("viewerErrorMsg");
  var res = await supabase.rpc("viewer_check", { p_password: pass });
  if (res.error || !res.data) {
    errBox.textContent = "كلمة السر غير صحيحة";
    errBox.style.display = "block";
    return;
  }
  setViewerPass(pass);
  showPanel();
}

function showPanel() {
  document.getElementById("viewerLoginScreen").style.display = "none";
  document.getElementById("viewerPanel").style.display = "block";
  loadAll();
}

async function loadAll() {
  await loadMembers();
  await Promise.all([loadAttendance(), loadTeamPoints()]);
}

// ============================================================
// الشباب + النقاط + الفرق
// ============================================================
async function loadMembers() {
  var res = await supabase.rpc("viewer_list_members", { p_password: getViewerPass() });
  if (res.error) {
    if (res.error.message && res.error.message.indexOf("unauthorized") !== -1) {
      clearViewerPass();
      location.reload();
    }
    return;
  }
  allMembers = res.data || [];
  document.getElementById("memberCount").textContent = allMembers.length;
  renderMembers();
}

var roleLabelMap = {
  leader: '👑 قائد فريق',
  room_admin: '🏠 أمين غرفة',
  retreat_servant: '🕊️ خادم الخلوة',
  project_reviewer: '📝 مصحح مشروع',
  member: 'عضو عادي'
};

function renderMembers() {
  var q = (document.getElementById("memberSearch").value || "").trim().toLowerCase();
  var tbody = document.querySelector("#membersTable tbody");
  var filtered = allMembers.filter(function (m) {
    return !q || (m.name || "").toLowerCase().indexOf(q) !== -1 ||
      (m.team_name || "").toLowerCase().indexOf(q) !== -1;
  });
  tbody.innerHTML = filtered.map(function (m) {
    var teamCell = m.team_name
      ? '<span class="pill">' + escapeHtml(m.team_name) + '</span>'
      : '<span style="color:var(--coral);font-size:11px">بدون فريق</span>';
    var roleCell = roleLabelMap[m.role] || roleLabelMap.member;
    return '<tr>' +
      '<td style="font-weight:600">' + escapeHtml(m.name) + '</td>' +
      '<td>' + teamCell + '</td>' +
      '<td>' + escapeHtml(roleCell) + '</td>' +
      '<td style="font-family:var(--font-display);font-weight:700;color:var(--gold)">' + (m.points || 0) + '</td>' +
      '</tr>';
  }).join("") || '<tr><td colspan="4">مفيش نتائج</td></tr>';
}

// ============================================================
// الفرق ونقاطها (مجموعة من نفس بيانات الأعضاء)
// ============================================================
async function loadTeamPoints() {
  // كمحاولة أولى: RPC العام لو موجود
  var teamMap = {};
  allMembers.forEach(function (m) {
    if (!m.team_name) return;
    teamMap[m.team_name] = (teamMap[m.team_name] || 0) + (m.points || 0);
  });
  var teams = Object.keys(teamMap)
    .map(function (n) { return { team_name: n, total_points: teamMap[n] }; })
    .sort(function (a, b) { return b.total_points - a.total_points; });

  var wrap = document.getElementById("teamPointsWrap");
  wrap.innerHTML = teams.map(function (t, i) {
    return '<div class="team-row" data-team="' + escapeHtml(t.team_name) + '">' +
      '<span class="team-rank">#' + (i + 1) + '</span>' +
      '<span class="team-name">' + escapeHtml(t.team_name) + '</span>' +
      '<span class="team-points">' + t.total_points + ' نقطة</span>' +
      '</div>';
  }).join("") || '<div style="color:var(--mist-dim);font-size:13px">لسه مفيش فرق</div>';

  wrap.querySelectorAll(".team-row").forEach(function (row) {
    row.addEventListener("click", function () {
      openTeamModal(row.dataset.team);
    });
  });
}

// ============================================================
// مودال تفاصيل الفريق
// ============================================================
async function openTeamModal(teamName) {
  document.getElementById("teamModalTitle").textContent = "فريق: " + teamName;
  document.getElementById("teamModalBody").innerHTML = "جاري التحميل...";
  document.getElementById("teamModal").classList.add("active");

  var res = await supabase.rpc("viewer_team_members", {
    p_password: getViewerPass(),
    p_team_name: teamName
  });
  var body = document.getElementById("teamModalBody");
  if (res.error || !res.data || !res.data.length) {
    body.innerHTML = '<div style="color:var(--mist-dim);font-size:13px">مفيش أعضاء في الفريق ده</div>';
    return;
  }
  body.innerHTML = res.data.map(function (m) {
    var roleCell = roleLabelMap[m.role] || roleLabelMap.member;
    return '<div class="member-mini-row" data-member="' + m.member_id + '" data-name="' + escapeHtml(m.name) + '">' +
      '<div>' +
        '<div class="member-mini-name">' + escapeHtml(m.name) + '</div>' +
        '<div class="member-mini-sub">' + escapeHtml(roleCell) + ' · حضر ' + m.room_sessions_attended + ' غرفة</div>' +
      '</div>' +
      '<span class="member-mini-pts">' + (m.points || 0) + '</span>' +
      '</div>';
  }).join("");

  body.querySelectorAll(".member-mini-row").forEach(function (row) {
    row.addEventListener("click", function () {
      openMemberModal(row.dataset.member, row.dataset.name, teamName);
    });
  });
}

// ============================================================
// مودال تفاصيل العضو (الغرف + مصادر النقاط)
// ============================================================
async function openMemberModal(memberId, memberName, teamName) {
  document.getElementById("teamModal").classList.remove("active");
  document.getElementById("memberModalTitle").textContent = memberName;
  document.getElementById("memberModalBody").innerHTML = "جاري التحميل...";
  document.getElementById("memberModal").classList.add("active");
  document.getElementById("memberModalBack").onclick = function () {
    document.getElementById("memberModal").classList.remove("active");
    document.getElementById("teamModal").classList.add("active");
  };

  var roomsRes = await supabase.rpc("viewer_member_rooms", {
    p_password: getViewerPass(), p_member_id: memberId
  });
  var pointsRes = await supabase.rpc("viewer_member_points_breakdown", {
    p_password: getViewerPass(), p_member_id: memberId
  });

  var html = "";

  html += '<h4 style="color:var(--mist);font-size:14px;margin:12px 0 8px">🏠 حضور الغرف</h4>';
  var rooms = (roomsRes.data || []);
  if (!rooms.length) {
    html += '<div style="color:var(--mist-dim);font-size:12px">لسه مفيش حضور غرف مسجل</div>';
  } else {
    html += '<ul class="detail-list">' + rooms.map(function (r) {
      var d = r.session_date ? new Date(r.session_date).toLocaleDateString("ar-EG") : "-";
      return '<li><span class="detail-src">' + escapeHtml(r.room_name || "-") + '</span>' +
        '<span class="detail-txt">' + d + ' · بواسطة ' + escapeHtml(r.secretary_name) + '</span>' +
        '<span class="detail-pts">' + ((r.session_pts||0) + (r.bonus_pts||0)) + '</span></li>';
    }).join("") + '</ul>';
  }

  html += '<h4 style="color:var(--mist);font-size:14px;margin:18px 0 8px">📊 مصادر النقاط</h4>';
  var pts = (pointsRes.data || []);
  if (!pts.length) {
    html += '<div style="color:var(--mist-dim);font-size:12px">لسه مفيش نقاط مسجلة من أنشطة تانية</div>';
  } else {
    html += '<ul class="detail-list">' + pts.map(function (p) {
      return '<li><span class="detail-src">' + escapeHtml(p.source) + '</span>' +
        '<span class="detail-txt">' + escapeHtml(p.detail || "-") + '</span>' +
        '<span class="detail-pts">' + (p.points || 0) + '</span></li>';
    }).join("") + '</ul>';
  }

  document.getElementById("memberModalBody").innerHTML = html;
}

// re-render team points whenever members reload (called after loadMembers in loadAll,
// but loadTeamPoints reads allMembers so ensure order — see loadAll below)

// ============================================================
// الحضور والغياب
// ============================================================
async function loadAttendance() {
  var res = await supabase.rpc("viewer_list_attendance", { p_password: getViewerPass() });
  if (res.error) return;
  allAttendance = res.data || [];
  renderAttendance();
}

function renderAttendance() {
  var q = (document.getElementById("attendanceSearch").value || "").trim().toLowerCase();
  var tbody = document.querySelector("#attendanceTable tbody");
  var filtered = allAttendance.filter(function (a) {
    return !q || (a.member_name || "").toLowerCase().indexOf(q) !== -1;
  });
  document.getElementById("attendanceCount").textContent = filtered.length;
  tbody.innerHTML = filtered.slice(0, 300).map(function (a) {
    var d = a.scanned_at ? new Date(a.scanned_at) : null;
    var when = d ? d.toLocaleString("ar-EG", { hour12: true }) : "-";
    var typeLabel = a.scan_type === "project" ? "📘 كتاب/مشروع" : (a.scan_type || "-");
    return '<tr>' +
      '<td style="font-weight:600">' + escapeHtml(a.member_name) + '</td>' +
      '<td>' + escapeHtml(typeLabel) + '</td>' +
      '<td style="color:var(--mist-dim);font-size:12px">' + when + '</td>' +
      '</tr>';
  }).join("") || '<tr><td colspan="3">مفيش تسجيلات</td></tr>';
}

// ============================================================
// تبويبات + init
// ============================================================
document.addEventListener("DOMContentLoaded", function () {
  if (getViewerPass()) showPanel();

  document.getElementById("viewerLoginBtn").addEventListener("click", tryViewerLogin);
  document.getElementById("viewerPassInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") tryViewerLogin();
  });
  document.getElementById("viewerLogoutBtn").addEventListener("click", function () {
    clearViewerPass();
    location.reload();
  });
  document.getElementById("refreshBtn").addEventListener("click", loadAll);

  document.getElementById("teamModalClose").addEventListener("click", function () {
    document.getElementById("teamModal").classList.remove("active");
  });
  document.getElementById("memberModalClose").addEventListener("click", function () {
    document.getElementById("memberModal").classList.remove("active");
  });
  document.getElementById("teamModal").addEventListener("click", function (e) {
    if (e.target.id === "teamModal") e.target.classList.remove("active");
  });
  document.getElementById("memberModal").addEventListener("click", function (e) {
    if (e.target.id === "memberModal") e.target.classList.remove("active");
  });
  document.getElementById("memberSearch").addEventListener("input", renderMembers);
  document.getElementById("attendanceSearch").addEventListener("input", renderAttendance);

  document.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
      document.querySelectorAll(".tab-panel").forEach(function (p) { p.classList.remove("active"); });
      tab.classList.add("active");
      document.getElementById("panel-" + tab.dataset.tab).classList.add("active");
    });
  });
});
