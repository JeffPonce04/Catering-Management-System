// public/service-worker.js

const CACHE_NAME = 'staff-management-v1';
const urlsToCache = [
  '/',
  '/static/js/main.chunk.js',
  '/static/css/main.chunk.css',
  '/api/v1/employees?per_page=1000',
  '/api/v1/departments?all=true',
  '/api/v1/positions?all=true',
  '/api/v1/salary-grades?all=true',
  '/api/v1/employees/stats'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});