// ============================================================
// supabaseclient.js — ثوابت مركزية + تهيئة Supabase
// ============================================================
window.SUPABASE_URL      = "https://knsuccfamscrjmdsjkkx.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_Nl5xeWScxZs8E-e8paCgDw_YZB1TDfA";
window.EDGE_FUNCTION_URL = window.SUPABASE_URL + "/functions/v1/smooth-action";

window._supabaseClient = window._supabaseClient || window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);
var supabase = window._supabaseClient;
