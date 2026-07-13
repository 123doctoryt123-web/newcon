// ============================================================
// supabaseclient.js — ثوابت مركزية + تهيئة Supabase
// ============================================================
window.SUPABASE_URL      = "https://uzsipqgbvgrperzdnqrg.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable__-efdxgVxoLDlKw0FsagYA_bUllFUJl";
window.EDGE_FUNCTION_URL = window.SUPABASE_URL + "/functions/v1/smooth-action";

window._supabaseClient = window._supabaseClient || window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);
var supabase = window._supabaseClient;
