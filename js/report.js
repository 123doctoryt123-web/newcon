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
    return '<div class="team-row">' +
      '<span class="team-rank">#' + (i + 1) + '</span>' +
      '<span class="team-name">' + escapeHtml(t.team_name) + '</span>' +
      '<span class="team-points">' + t.total_points + ' نقطة</span>' +
      '</div>';
  }).join("") || '<div style="color:var(--mist-dim);font-size:13px">لسه مفيش فرق</div>';
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
