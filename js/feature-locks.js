// ============================================================
// feature-locks.js — قفل/فتح صندوق الأسرار، درس الكتاب، جدار الامتنان
// ============================================================

var featureKeys = {
  secretbox: "secretbox_open",
  book: "book_open",
  gratitude: "gratitude_open",
  puzzle: "puzzle_open"
};

var featureState = {};

async function loadFeatureLocks() {
  for (var name in featureKeys) {
    var key = featureKeys[name];
    var res = await supabase.rpc("get_feature_status", { p_key: key });
    var isOpen = res.error ? true : res.data;
    featureState[name] = isOpen;
    updateFeatureBtn(name, isOpen);
  }
}

function updateFeatureBtn(name, isOpen) {
  var btnId = "toggle" + name.charAt(0).toUpperCase() + name.slice(1) + "Btn";
  var btn = document.getElementById(btnId);
  if (!btn) return;
  btn.textContent = isOpen ? "🔓 مفتوح — اقفله" : "🔒 مقفول — افتحه";
}

async function toggleFeature(name) {
  var key = featureKeys[name];
  var newState = !featureState[name];
  var pass = (typeof getAdminPass === "function") ? getAdminPass() : (sessionStorage.getItem("adminPass") || window._adminPass);
  var res = await supabase.rpc("admin_set_feature_status", { p_password: pass, p_key: key, p_open: newState });
  var msgBox = document.getElementById("featureLockMsg");
  if (res.error) {
    if (msgBox) msgBox.innerHTML = '<div class="error-msg" style="display:block">خطأ: ' + res.error.message + '</div>';
    return;
  }
  featureState[name] = newState;
  updateFeatureBtn(name, newState);
  if (msgBox) {
    msgBox.innerHTML = '<div class="success-msg" style="display:block">✅ اتحدّث</div>';
    setTimeout(function () { msgBox.innerHTML = ""; }, 2000);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  loadFeatureLocks();
  var secretboxBtn = document.getElementById("toggleSecretboxBtn");
  var bookBtn = document.getElementById("toggleBookBtn");
  var gratitudeBtn = document.getElementById("toggleGratitudeBtn");
  var puzzleBtn = document.getElementById("togglePuzzleBtn");
  if (secretboxBtn) secretboxBtn.addEventListener("click", function () { toggleFeature("secretbox"); });
  if (bookBtn) bookBtn.addEventListener("click", function () { toggleFeature("book"); });
  if (gratitudeBtn) gratitudeBtn.addEventListener("click", function () { toggleFeature("gratitude"); });
  if (puzzleBtn) puzzleBtn.addEventListener("click", function () { toggleFeature("puzzle"); });
});
