// ============================================================
// notifications.js — إشعارات Push
// ============================================================
var VAPID_PUBLIC = "BDjDn65U9lmoWIWUcCdrFi_ZswSN1CpWieyntx0wUws43LcIXpONaDJufCabdTMRz-9Ag8QHl3DNFvaDm0SjoWM";

function urlBase64ToUint8Array(base64String) {
  var padding = "=".repeat((4 - base64String.length % 4) % 4);
  var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  var raw = atob(base64);
  var output = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function registerPush(memberId) {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
  var perm = await Notification.requestPermission();
  if (perm !== "granted") return false;
  var reg = await navigator.serviceWorker.ready;
  var sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
  });
  var subJson = sub.toJSON();
  var res = await supabase.rpc("save_push_subscription", {
    p_member_id: memberId,
    p_endpoint:  subJson.endpoint,
    p_p256dh:    subJson.keys.p256dh,
    p_auth:      subJson.keys.auth
  });
  return !res.error;
}

function setupNotifButton(memberId) {
  var btn = document.getElementById("notifBtn");
  if (!btn) return;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    btn.textContent = "❌ المتصفح مش بيدعم الإشعارات";
    btn.disabled = true;
    return;
  }
  if (Notification.permission === "granted") {
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
        btn.textContent = "❌ مش قادر يفعّل";
        btn.disabled = false;
      }
    } catch (e) {
      btn.textContent = "❌ حصل خطأ، حاول تاني";
      btn.disabled = false;
    }
  });
}
