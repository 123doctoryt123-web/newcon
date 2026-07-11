function saveSession(member){
  localStorage.setItem("member", JSON.stringify(member));
}
function getSession(){
  var raw = localStorage.getItem("member");
  return raw ? JSON.parse(raw) : null;
}
function clearSession(){
  localStorage.removeItem("member");
}
function requireSession(){
  var m = getSession();
  if(!m){ window.location.href = "index.html"; return null; }
  return m;
}
function logout(){
  clearSession();
  window.location.href = "index.html";
}

/* ============================================================
   قفل/بلور الموقع بالكامل — يشتغل تلقائيًا في أي صفحة بتحمّل
   auth.js (ما عدا صفحة الدخول والتسجيل، عشان تفضل شغالة دايمًا)
   الأدمن بس اللي بيتحكم فيه من admin.html > الإعدادات
   ============================================================ */
(function () {
  var page = (window.location.pathname.split("/").pop() || "").toLowerCase();
  var EXCLUDED_PAGES = ["index.html", "register.html", ""];
  if (EXCLUDED_PAGES.indexOf(page) !== -1) return;

  var OVERLAY_ID = "siteLockOverlay";
  var STYLE_ID = "siteLockStyle";

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      "body.site-locked > *:not(#" + OVERLAY_ID + "):not(script){" +
      "filter:blur(14px) saturate(70%);pointer-events:none !important;user-select:none !important;}" +
      "body.site-locked{overflow:hidden !important;height:100vh;}" +
      "#" + OVERLAY_ID + "{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;" +
      "justify-content:center;padding:24px;background:radial-gradient(circle at 50% 30%,rgba(28,46,69,0.72),rgba(6,15,24,0.92));" +
      "backdrop-filter:blur(2px);animation:siteLockFade .35s ease;}" +
      "@keyframes siteLockFade{from{opacity:0}to{opacity:1}}" +
      "#" + OVERLAY_ID + " .slk-card{max-width:340px;width:100%;text-align:center;" +
      "background:linear-gradient(160deg,#152235,#1C2E45);border:1px solid rgba(200,160,100,0.25);" +
      "border-radius:18px;padding:32px 22px;box-shadow:0 20px 60px rgba(0,0,0,0.5);}" +
      "#" + OVERLAY_ID + " .slk-icon{width:64px;height:64px;border-radius:50%;margin:0 auto 16px;" +
      "display:flex;align-items:center;justify-content:center;font-size:30px;" +
      "background:linear-gradient(135deg,#C8975A,#a07840);box-shadow:0 0 22px rgba(200,150,90,0.45);" +
      "animation:siteLockPulse 2.2s ease-in-out infinite;}" +
      "@keyframes siteLockPulse{0%,100%{transform:scale(1);}50%{transform:scale(1.06);}}" +
      "#" + OVERLAY_ID + " .slk-title{font-family:'Changa','Tajawal',sans-serif;font-weight:800;" +
      "font-size:18px;color:#E8E0D0;margin-bottom:8px;}" +
      "#" + OVERLAY_ID + " .slk-msg{font-family:'Tajawal',sans-serif;font-size:13.5px;line-height:1.8;" +
      "color:#A09880;margin-bottom:18px;}" +
      "#" + OVERLAY_ID + " .slk-logout{display:inline-block;font-size:12.5px;color:#A09880;" +
      "border:1px solid rgba(200,160,100,0.25);border-radius:99px;padding:8px 18px;cursor:pointer;" +
      "font-family:'Tajawal',sans-serif;}" +
      "#" + OVERLAY_ID + " .slk-logout:hover{color:#C0533A;border-color:#C0533A;}";
    var tag = document.createElement("style");
    tag.id = STYLE_ID;
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  function showOverlay(message) {
    injectStyle();
    document.body.classList.add("site-locked");
    if (document.getElementById(OVERLAY_ID)) return;
    var overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.innerHTML =
      '<div class="slk-card">' +
      '<div class="slk-icon">🔒</div>' +
      '<div class="slk-title">لسه الوقت ما جاش</div>' +
      '<div class="slk-msg">' + (message || "قريبًا هيتفتح كل حاجة... استنى شوية 👀") + "</div>" +
      '<div class="slk-logout" id="slkLogoutBtn">خروج</div>' +
      "</div>";
    document.body.appendChild(overlay);
    var logoutBtn = document.getElementById("slkLogoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        try { clearSession(); } catch (e) {}
        window.location.href = "index.html";
      });
    }
  }

  async function checkSiteLock() {
    try {
      if (typeof supabase === "undefined") return;
      var res = await supabase.rpc("get_site_lock_status");
      if (res.error || !res.data) return;
      var row = Array.isArray(res.data) ? res.data[0] : res.data;
      if (row && row.is_locked) showOverlay(row.lock_message);
    } catch (e) {
      console.warn("تعذّر التحقق من حالة قفل الموقع:", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkSiteLock);
  } else {
    checkSiteLock();
  }
})();

/* ============================================================
   تتبع "الموجودين الآن" — بيبلّغ لوحة الأدمن إن الشخص ده فاتح
   الموقع دلوقتي وفي أنهي صفحة. بيبعت نبضة كل 20 ثانية
   ============================================================ */
(function () {
  function sendHeartbeat(member, page) {
    supabase.rpc("heartbeat_online", {
      p_member_id: member.id,
      p_name: member.name,
      p_page: page
    }).then(function (res) {
      if (res.error) console.warn("[online-presence] تعذّر إرسال النبضة:", res.error);
    });
  }

  function startHeartbeat() {
    if (typeof supabase === "undefined") return;
    var member = getSession();
    if (!member) return;
    var page = (window.location.pathname.split("/").pop() || "").toLowerCase();
    sendHeartbeat(member, page);
    setInterval(function () { sendHeartbeat(member, page); }, 20000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startHeartbeat);
  } else {
    startHeartbeat();
  }
})();
