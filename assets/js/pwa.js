/* ASM 2027 event app — install prompt and offline status */
(function () {
  "use strict";

  var installBtn = document.getElementById("installBtn");
  var netStatus = document.getElementById("netStatus");
  var deferred = null;
  var refreshing = false;

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {
        /* the app still works online without the service worker */
      });
    });
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferred = event;
    if (installBtn) installBtn.hidden = false;
  });

  if (installBtn) {
    installBtn.addEventListener("click", function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function () {
        deferred = null;
        installBtn.hidden = true;
      });
    });
  }

  window.addEventListener("appinstalled", function () {
    if (installBtn) installBtn.hidden = true;
  });

  function updateNet() {
    if (netStatus) netStatus.hidden = navigator.onLine;
  }

  window.addEventListener("online", updateNet);
  window.addEventListener("offline", updateNet);
  updateNet();
})();
