// ============================================================
// notifications.js — إشعارات Push
// ============================================================
var VAPID_PUBLIC = "BDjDn65U9lmoWIWUcCdrFi_ZswSN1CpWieyntx0wUws43LcIXpONaDJufCabdTMRz-9Ag8QHl3DNFvaDm0SjoWM";
var EDGE_FUNCTION_URL = "https://ujlonszkibczmkasryuq.supabase.co/functions/v1/smooth-action";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqbG9uc3praWJjem1rYXNyeXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNjE5NTcsImV4cCI6MjA5NzczNzk1N30.WgHQOnblLlGjyyAKq2PBTq2zkjTps8CX6E4Hx1_ZwYQ";

function urlBase64ToUint8Array(base64String) {
  var padding = "=".repeat((4 - base64String.length % 4) % 4);
  var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  var raw = atob(base64);
  var output = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

// path الـ SW ديناميكي بناءً على مكان الموقع
var SW_PATH = (function() {
  var loc = window.location.pathname;
  var dir = loc.substring(0, loc.lastIndexOf("/") + 1);
  return dir + "sw.js";
})();

// تسجيل الـ Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register(SW_PATH).then(function(reg) {
    console.log("SW registered at scope:", reg.scope);
  }).catch(function (err) {
    console.warn("SW registration failed:", err);
  });
}

async function registerPush(memberId) {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    console.warn("PUSH FAIL: browser missing Notification or SW support");
    return false;
  }

  var perm = await Notification.requestPermission();
  console.log("Notification permission:", perm);
  if (perm !== "granted") return false;

  var reg;
  try {
    reg = await navigator.serviceWorker.ready;
    console.log("SW ready, scope:", reg.scope);
  } catch(e) {
    console.error("SW not ready:", e);
    return false;
  }

  // تحقق إن pushManager موجود (iOS بيحتاج PWA)
  if (!reg.pushManager) {
    console.warn("PUSH FAIL: pushManager not available");
    return false;
  }

  var sub;
  try {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
    console.log("Push subscribed:", sub.endpoint);
  } catch(e) {
    console.error("pushManager.subscribe failed:", e.name, e.message);
    return false;
  }

  var subJson = sub.toJSON();

  if (!subJson.endpoint || !subJson.keys || !subJson.keys.p256dh || !subJson.keys.auth) {
    console.warn("Incomplete subscription:", subJson);
    return false;
  }

  // احفظ في Supabase
  var res = await supabase.rpc("save_push_subscription", {
    p_member_id: memberId,
    p_endpoint: subJson.endpoint,
    p_p256dh: subJson.keys.p256dh,
    p_auth: subJson.keys.auth,
  });

  if (res.error) {
    console.error("Supabase save failed:", res.error);
    return false;
  }

  // Edge Function
  try {
    await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        action: "subscribe",
        member_id: memberId,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
      }),
    });
  } catch (e) {
    console.warn("Edge Function subscribe failed:", e);
  }

  return true;
}

// ============================================================
// iOS detection
// ============================================================
function isIosSafariNotPwa() {
  var isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  var isInPwa = window.navigator.standalone === true;
  return isIos && !isInPwa;
}

function showIosInstallBanner() {
  if (document.getElementById("iosPwaBanner")) return;
  var banner = document.createElement("div");
  banner.id = "iosPwaBanner";
  banner.style.cssText =
    "position:fixed;bottom:0;right:0;left:0;z-index:9999;" +
    "background:#16273d;border-top:2px solid #c8964d;" +
    "padding:16px 16px 28px;font-family:sans-serif;direction:rtl";
  banner.innerHTML =
    '<div style="display:flex;align-items:flex-start;gap:12px">' +
      '<div style="font-size:28px;flex-shrink:0">📲</div>' +
      '<div style="flex:1">' +
        '<strong style="font-size:14px;color:#c8964d;display:block;margin-bottom:7px">عشان تشتغل الإشعارات على iPhone</strong>' +
        '<p style="font-size:13px;color:#ccc;margin:0;line-height:1.8">' +
          '١. اضغط زرار <strong style="color:#fff">المشاركة ⎋</strong> في أسفل Safari<br>' +
          '٢. اختار <strong style="color:#fff">"إضافة إلى الشاشة الرئيسية"</strong><br>' +
          '٣. افتح التطبيق من الهوم سكرين وفعّل الإشعارات' +
        '</p>' +
      '</div>' +
      '<button onclick="document.getElementById(\'iosPwaBanner\').remove()" ' +
        'style="background:none;border:none;color:#888;font-size:22px;cursor:pointer;padding:0;line-height:1;flex-shrink:0">✕</button>' +
    '</div>';
  document.body.appendChild(banner);
}

// ============================================================
// زرار تفعيل الإشعارات
// ============================================================
function setupNotifButton(memberId) {
  var btn = document.getElementById("notifBtn");
  if (!btn) return;

  if (isIosSafariNotPwa()) {
    btn.textContent = "📲 أضف الموقع للهوم سكرين لتفعيل الإشعارات";
    btn.style.color = "var(--gold)";
    btn.style.borderColor = "var(--gold)";
    btn.addEventListener("click", function () { showIosInstallBanner(); });
    setTimeout(showIosInstallBanner, 2000);
    return;
  }

  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    btn.textContent = "❌ المتصفح مش بيدعم الإشعارات";
    btn.disabled = true;
    return;
  }

  if (Notification.permission === "granted") {
    // محتمل اشتراك موجود — جرب تجدده في الخلفية بهدوء
    navigator.serviceWorker.ready.then(function(reg) {
      if (!reg.pushManager) return;
      reg.pushManager.getSubscription().then(function(existing) {
        if (!existing) {
          // الإذن موجود بس الاشتراك انمسح — جدده
          registerPush(memberId).then(function(ok) {
            if (ok) console.log("Push re-subscribed silently");
          });
        }
      });
    });
    btn.textContent = "🔔 الإشعارات مفعّلة ✅";
    btn.style.color = "var(--gold)";
    btn.disabled = true;
    return;
  }

  btn.addEventListener("click", async function () {
    btn.disabled = true;
    btn.textContent = "جاري التفعيل...";
    try {
      var ok = await registerPush(memberId);
      if (ok) {
        btn.textContent = "🔔 الإشعارات مفعّلة ✅";
        btn.style.color = "var(--gold)";
      } else {
        btn.textContent = "❌ مش قادر يفعّل — اسمح بالإشعارات";
        btn.disabled = false;
      }
    } catch (e) {
      console.error("setupNotifButton error:", e);
      btn.textContent = "❌ حصل خطأ، حاول تاني";
      btn.disabled = false;
    }
  });
}
