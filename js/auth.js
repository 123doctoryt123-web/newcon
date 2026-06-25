function saveSession(member){
  localStorage.setItem("member", JSON.stringify(member));
}
function getSession(){
  var raw = localStorage.getItem("member");
  return raw ? JSON.parse(raw) : null;
}
function clearSession(){
  localStorage.removeItem("member");
}
function requireSession(){
  var m = getSession();
  if(!m){ window.location.href = "index.html"; return null; }
  return m;
}
function logout(){
  clearSession();
  window.location.href = "index.html";
}
