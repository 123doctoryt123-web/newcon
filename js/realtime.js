// ============================================================
// realtime.js — تحديث تلقائي لكل الصفحات
// ضيفه في js/realtime.js
// وضيف السطر ده في كل صفحة قبل </body>:
// <script src="js/realtime.js"></script>
// ============================================================

(function () {
  var page = location.pathname.split("/").pop() || "index.html";

  // ============================================================
  // مساعد: reload ناعم (بدون وميض)
  // ============================================================
  function softReload(fn) {
    if (typeof fn === "function") fn();
    else location.reload();
  }

  // ============================================================
  // 1) الداشبورد — إعلانات جديدة
  // ============================================================
  if (page === "dashboard.html") {
    supabase
      .channel("rt-announcements")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "announcements"
      }, function () {
        if (typeof loadLatestAnnouncement === "function") loadLatestAnnouncement();
      })
      .subscribe();

    // تحديث النقاط والفريق لو تغيرت
    supabase
      .channel("rt-members-dash")
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "members"
      }, function () {
        if (typeof loadTeamInfo === "function") loadTeamInfo();
      })
      .subscribe();
  }

  // ============================================================
  // 2) البرنامج — نشاط جديد
  // ============================================================
  if (page === "program.html") {
    supabase
      .channel("rt-program")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "program_items"
      }, function () {
        if (typeof loadProgram === "function") loadProgram();
      })
      .subscribe();
  }

  // ============================================================
  // 3) الجاسوس — لعبة جديدة / إيقاف
  // ============================================================
  if (page === "spy.html") {
    supabase
      .channel("rt-spy")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "spy_games"
      }, function () {
        if (typeof loadGame === "function") loadGame();
      })
      .on("postgres_changes", {
        event: "*", schema: "public", table: "spy_roles"
      }, function () {
        if (typeof loadGame === "function") loadGame();
      })
      .subscribe();
  }

  // ============================================================
  // 4) التوقعات — قفل / فتح + تغيير أسماء الفرق
  // ============================================================
  if (page === "predict.html") {
    supabase
      .channel("rt-settings-predict")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "settings"
      }, function () {
        if (typeof init === "function") init();
      })
      .subscribe();
  }

  // ============================================================
  // 5) الخلوة — لما الأدمن يغيّر الموعد أو المكان
  // ============================================================
  if (page === "retreat.html") {
    supabase
      .channel("rt-retreat")
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "retreat_slots"
      }, function (payload) {
        if (typeof loadRetreatSlot === "function") loadRetreatSlot();
      })
      .subscribe();
  }

  // ============================================================
  // 6) درس الكتاب — لما الأدمن يغيّر الرابط
  // ============================================================
  if (page === "book.html") {
    supabase
      .channel("rt-settings-book")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "settings"
      }, function () {
        if (typeof loadForm === "function") loadForm();
      })
      .subscribe();
  }

  // ============================================================
  // 7) لوحة التحكم — تحديث تلقائي لكل الجداول
  // ============================================================
  if (page === "admin.html") {
    // تحديث قايمة الشباب
    supabase
      .channel("rt-admin-members")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "members"
      }, function () {
        if (typeof loadMembers === "function") loadMembers();
        if (typeof loadManualMembers === "function") loadManualMembers();
      })
      .subscribe();

    // تحديث الخلوة
    supabase
      .channel("rt-admin-retreat")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "retreat_slots"
      }, function () {
        if (typeof loadRetreatSlots === "function") loadRetreatSlots();
      })
      .subscribe();

    // تحديث الإعلانات
    supabase
      .channel("rt-admin-ann")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "announcements"
      }, function () {
        if (typeof loadCurrentAnnouncement === "function") loadCurrentAnnouncement();
      })
      .subscribe();
  }

  // ============================================================
  // 8) المواد والمشاركات
  // ============================================================
  if (page === "project.html") {
    supabase
      .channel("rt-materials")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "materials"
      }, function () {
        if (typeof loadmaterials === "function") loadmaterials();
      })
      .subscribe();
  }

})();
