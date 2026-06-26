// ============================================================
// supabaseclient.js — ثوابت مركزية + تهيئة Supabase
// ============================================================
window.SUPABASE_URL      = "https://ujlonszkibczmkasryuq.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqbG9uc3praWJjem1rYXNyeXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNjE5NTcsImV4cCI6MjA5NzczNzk1N30.WgHQOnblLlGjyyAKq2PBTq2zkjTps8CX6E4Hx1_ZwYQ";
window.EDGE_FUNCTION_URL = window.SUPABASE_URL + "/functions/v1/smooth-action";

window._supabaseClient = window._supabaseClient || window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);
var supabase = window._supabaseClient;
