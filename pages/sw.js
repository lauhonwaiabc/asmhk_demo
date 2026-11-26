/* ASM 2027 event app - service worker (prototype) */
"use strict";

var CACHE = "asm2027-v117";
var SHELL = [
  "./app.html",
  "./programme.html",
  "./faculty.html",
  "./our-sponsors.html",
  "./committees.html",
  "./contact-us.html",
  "./past-asm.html",
  "../404.html",
  "./slot-qr.html",
  "./e-posters.html",
  "./call-for-abstracts.html",
  "./call-for-eposter.html",
  "./call-for-formal-project.html",
  "./formal-project-prize.html",
  "./registration.html",
  "./meeting-information.html",
  "./academic-accreditation.html",
  "./manifest.webmanifest",
  "../assets/css/style.css",
  "../assets/css/motion.css",
  "../assets/css/site.css",
  "../assets/css/app.css",
  "../assets/js/app.js",
  "../assets/js/qr.js",
  "../assets/js/connect.js",
  "../assets/js/attendance.js",
  "../assets/js/slot-qr.js",
  "../assets/js/vendor/jsQR.min.js",
  "../assets/js/pwa.js",
  "../assets/js/data/meta.js",
  "../assets/js/data/committee.js",
  "../assets/js/data/people.js",
  "../assets/js/data/programme.js",
  "../assets/js/data/pages.js",
  "../assets/js/data/abstracts.js",
  "../assets/js/data/registration.js",
  "../assets/js/data/sponsors.js",
  "../assets/js/data/contact.js",
  "../assets/js/data/news.js",
  "../assets/js/data/accommodation.js",
  "../assets/js/data/cpd.js",
  "../assets/js/event-facts.js",
  "../assets/js/asm-data.js",
  "../assets/js/asm-render.js",
  "../assets/js/main.js",
  "../assets/js/motion.js",
  "../assets/js/site.js",
  "../assets/images/favicon.svg",
  "../assets/images/asm2027-logo.png",
  "../assets/images/asm2027-logo-full.png",
  "../assets/icons/favicon-16.png",
  "../assets/icons/favicon-32.png",
  "../assets/icons/icon.svg",
  "../assets/images/logo.png",
  "../assets/icons/icon-192.png",
  "../assets/icons/icon-512.png",
  "../assets/icons/icon-maskable-512.png",
  "../assets/icons/apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key !== CACHE;
      }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function networkFirst(request, fallbackUrl) {
  return fetch(request, { cache: "no-store" }).then(function (response) {
    if (response && response.ok) {
      var copy = response.clone();
      caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
    }
    return response;
  }).catch(function () {
    return caches.match(request).then(function (cached) {
      return cached || caches.match(request, { ignoreSearch: true });
    }).then(function (cached) {
      return cached || (fallbackUrl ? caches.match(fallbackUrl) : null);
    });
  });
}

function cacheFirst(request) {
  return caches.match(request).then(function (cached) {
    if (cached) return cached;
    return caches.match(request, { ignoreSearch: true }).then(function (fallback) {
      if (fallback) return fallback;
      return fetch(request).then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      });
    });
  });
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "./app.html"));
    return;
  }

  if (url.pathname.indexOf("/css/") !== -1 || url.pathname.indexOf("/js/") !== -1) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
