// ============================================================
// supabaseclient.js — ثوابت مركزية + تهيئة Supabase
// ============================================================
window.SUPABASE_URL      = "https://uzsipqgbvgrperzdnqrg.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6c2lwcWdidmdycGVyemRucXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjE3MTAsImV4cCI6MjA5ODYzNzcxMH0.0ZplujpGR-71R6XZ8wjmnuqWrllNPNx1MxnkW5cSQ5U";
window.EDGE_FUNCTION_URL = window.SUPABASE_URL + "/functions/v1/smooth-action";

window._supabaseClient = window._supabaseClient || window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);
var supabase = window._supabaseClient;
