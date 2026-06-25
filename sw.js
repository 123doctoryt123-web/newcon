const CACHE_NAME = 'connect3-v2';
const urlsToCache = [
  '/', '/index.html', '/dashboard.html', '/predict.html',
  '/project.html', '/program.html', '/spy.html', '/book.html',
  '/message.html', '/css/style.css', '/js/auth.js',
  '/js/supabaseclient.js', '/logo.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE_NAME).then(function(c){ return c.addAll(urlsToCache); }));
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(e){
  var data={};
  try{ data=e.data.json(); } catch(err){ data={title:'Connect Three',body:e.data.text()}; }
  var options={
    body: data.body||'',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: data.alarm ? [500,200,500,200,500] : [200,100,200],
    requireInteraction: data.alarm||false,
    data: { url: data.url||'/dashboard.html' }
  };
  if(data.alarm){ options.actions=[{action:'dismiss',title:'تم ✅'}]; }
  e.waitUntil(self.registration.showNotification(data.title||'Connect Three 🔔', options));
});

self.addEventListener('notificationclick', function(e){
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url||'/dashboard.html'));
});
