// ============================================================
// realtime.js — تحديث تلقائي لكل الصفحات
// ضيفه في js/realtime.js
// وضيف السطر ده في كل صفحة قبل </body>:
// <script src="js/realtime.js"></script>
// ============================================================

(function () {
  var page = location.pathname.split("/").pop() || "index.html";

  // ============================================================
  // مساعد: يربط channel، يطبع حالة الاتصال في الـ console،
  // ويعيد المحاولة تلقائياً لو الاتصال قفل أو حصل فيه تايم آوت
  // ============================================================
  function subscribeWithRetry(channelName, configureFn) {
    function start() {
      var channel = supabase.channel(channelName);
      configureFn(channel);
      channel.subscribe(function (status, err) {
        console.log("[realtime] " + channelName + " -> " + status, err || "");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          // حاول تاني بعد 3 ثواني
          setTimeout(function () {
            try { supabase.removeChannel(channel); } catch (e) {}
            start();
          }, 3000);
        }
      });
      return channel;
    }
    return start();
  }

  console.log("[realtime] تم تحميل realtime.js على صفحة:", page);

  // ============================================================
  // 1) الداشبورد — إعلانات جديدة
  // ============================================================
  if (page === "dashboard.html") {
    subscribeWithRetry("rt-announcements", function (channel) {
      channel.on("postgres_changes", {
        event: "*", schema: "public", table: "announcements"
      }, function (payload) {
        console.log("[realtime] announcements event:", payload);
        if (typeof loadLatestAnnouncement === "function") loadLatestAnnouncement();
      });
    });

    // تحديث النقاط والفريق لو تغيرت
    subscribeWithRetry("rt-members-dash", function (channel) {
      channel.on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "members"
      }, function () {
        if (typeof loadTeamInfo === "function") loadTeamInfo();
      });
    });

    // ------------------------------------------------------------
    // شبكة أمان: بوللينج كل 15 ثانية للإعلانات
    // عشان لو الـ WebSocket انقطع لأي سبب (الجهاز قفل، الشبكة
    // اتقطعت لحظة، التاب فضل فاتح فترة طويلة...) يفضل التحديث
    // شغال برضو حتى لو متأخر شوية
    // ------------------------------------------------------------
    setInterval(function () {
      if (typeof loadLatestAnnouncement === "function") loadLatestAnnouncement();
    }, 15000);
  }

  // ============================================================
  // 2) البرنامج — نشاط جديد
  // ============================================================
  if (page === "program.html") {
    subscribeWithRetry("rt-program", function (channel) {
      channel.on("postgres_changes", {
        event: "*", schema: "public", table: "program_items"
      }, function () {
        if (typeof loadProgram === "function") loadProgram();
      });
    });
  }

  // ============================================================
  // 3) الجاسوس — لعبة جديدة / إيقاف
  // ============================================================
  if (page === "spy.html") {
    subscribeWithRetry("rt-spy", function (channel) {
      channel
        .on("postgres_changes", {
          event: "*", schema: "public", table: "spy_games"
        }, function () {
          if (typeof loadGame === "function") loadGame();
        })
        .on("postgres_changes", {
          event: "*", schema: "public", table: "spy_roles"
        }, function () {
          if (typeof loadGame === "function") loadGame();
        });
    });
  }

  // ============================================================
  // 4) التوقعات — قفل / فتح + تغيير أسماء الفرق
  // ============================================================
  if (page === "predict.html") {
    subscribeWithRetry("rt-settings-predict", function (channel) {
      channel.on("postgres_changes", {
        event: "*", schema: "public", table: "settings"
      }, function () {
        if (typeof init === "function") init();
      });
    });
  }

  // ============================================================
  // 5) الخلوة — لما الأدمن يغيّر الموعد أو المكان
  // ============================================================
  if (page === "retreat.html") {
    subscribeWithRetry("rt-retreat", function (channel) {
      channel.on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "retreat_slots"
      }, function (payload) {
        if (typeof loadRetreatSlot === "function") loadRetreatSlot();
      });
    });
  }

  // ============================================================
  // 6) درس الكتاب — لما الأدمن يغيّر الرابط
  // ============================================================
  if (page === "book.html") {
    subscribeWithRetry("rt-settings-book", function (channel) {
      channel.on("postgres_changes", {
        event: "*", schema: "public", table: "settings"
      }, function () {
        if (typeof loadForm === "function") loadForm();
      });
    });
  }

  // ============================================================
  // 7) لوحة التحكم — تحديث تلقائي لكل الجداول
  // ============================================================
  if (page === "admin.html") {
    // تحديث قايمة الشباب
    subscribeWithRetry("rt-admin-members", function (channel) {
      channel.on("postgres_changes", {
        event: "*", schema: "public", table: "members"
      }, function () {
        if (typeof loadMembers === "function") loadMembers();
        if (typeof loadManualMembers === "function") loadManualMembers();
      });
    });

    // تحديث الخلوة
    subscribeWithRetry("rt-admin-retreat", function (channel) {
      channel.on("postgres_changes", {
        event: "*", schema: "public", table: "retreat_slots"
      }, function () {
        if (typeof loadRetreatSlots === "function") loadRetreatSlots();
      });
    });

    // تحديث الإعلانات
    subscribeWithRetry("rt-admin-ann", function (channel) {
      channel.on("postgres_changes", {
        event: "*", schema: "public", table: "announcements"
      }, function () {
        if (typeof loadCurrentAnnouncement === "function") loadCurrentAnnouncement();
      });
    });
  }

  // ============================================================
  // 8) المواد والمشاركات
  // ============================================================
  if (page === "project.html") {
    subscribeWithRetry("rt-materials", function (channel) {
      channel.on("postgres_changes", {
        event: "*", schema: "public", table: "materials"
      }, function () {
        if (typeof loadmaterials === "function") loadmaterials();
      });
    });
  }

  // ============================================================
  // 9) إعادة الاشتراك لو الصفحة رجعت تظهر بعد ما كانت مخفية
  // (مثلاً المستخدم رجع للتاب بعد ما سرّح أو غيّر تاب تاني)
  // ============================================================
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      console.log("[realtime] الصفحة رجعت تظهر — بنحدّث البيانات");
      if (page === "dashboard.html" && typeof loadLatestAnnouncement === "function") {
        loadLatestAnnouncement();
      }
      if (page === "admin.html" && typeof loadCurrentAnnouncement === "function") {
        loadCurrentAnnouncement();
      }
    }
  });

})();
