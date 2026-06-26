// ============================================================
// notifications.js — إشعارات Push (مصلّح مع تسجيل SW)
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

// تسجيل الـ Service Worker أول ما الصفحة تتحمل
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(function (err) {
    console.warn("SW registration failed:", err);
  });
}

async function registerPush(memberId) {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;

  var perm = await Notification.requestPermission();
  if (perm !== "granted") return false;

  // انتظر لحد ما الـ SW يبقى جاهز
  var reg = await navigator.serviceWorker.ready;

  var sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
  });

  var subJson = sub.toJSON();

  // تحقق إن البيانات كلها موجودة وسليمة قبل أي حفظ
  if (!subJson.endpoint || !subJson.keys || !subJson.keys.p256dh || !subJson.keys.auth) {
    console.warn("اشتراك ناقص، تم تجاهله:", subJson);
    return false;
  }

  // احفظ في Supabase
  var res = await supabase.rpc("save_push_subscription", {
    p_member_id: memberId,
    p_endpoint: subJson.endpoint,
    p_p256dh: subJson.keys.p256dh,
    p_auth: subJson.keys.auth,
  });

  // وفي Edge Function كمان (للإرسال)
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

  return !res.error;
}

// ============================================================
// هل الجهاز iPhone/iPad في Safari العادي (مش PWA مضافة للهوم سكرين)؟
// ============================================================
function isIosSafariNotPwa() {
  var ua = navigator.userAgent;
  var isIos = /iphone|ipad|ipod/i.test(ua);
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
        '<strong style="font-size:14px;color:#c8964d;display:block;margin-bottom:7px">' +
          'عشان تشتغل الإشعارات على iPhone' +
        '</strong>' +
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
// زرار تفعيل الإشعارات — بيتعامل مع iOS بشكل مختلف
// ============================================================
function setupNotifButton(memberId) {
  var btn = document.getElementById("notifBtn");
  if (!btn) return;

  // iPhone/iPad في Safari العادي — الإشعارات مش ممكنة بدون PWA
  if (isIosSafariNotPwa()) {
    btn.textContent = "📲 أضف الموقع للهوم سكرين لتفعيل الإشعارات";
    btn.style.color = "var(--gold)";
    btn.style.borderColor = "var(--gold)";
    btn.addEventListener("click", function () { showIosInstallBanner(); });
    // بانر تلقائي بعد ثانيتين
    setTimeout(showIosInstallBanner, 2000);
    return;
  }

  // باقي المتصفحات اللي مش بتدعم الإشعارات
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    btn.textContent = "❌ المتصفح مش بيدعم الإشعارات";
    btn.disabled = true;
    return;
  }

  // الإشعارات مفعّلة فعلاً
  if (Notification.permission === "granted") {
    btn.textContent = "🔔 الإشعارات مفعّلة ✅";
    btn.style.color = "var(--gold)";
    btn.disabled = true;
    return;
  }

  // الحالة العادية — زرار تفعيل
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
      console.error(e);
      btn.textContent = "❌ حصل خطأ، حاول تاني";
      btn.disabled = false;
    }
  });
}
