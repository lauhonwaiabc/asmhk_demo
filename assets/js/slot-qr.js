/* ASM 2027 — organiser slot QR page
   Renders one QR code per session, symposium and workshop. Each code is
   unique to the session, but the Stamp Collection counts the parent slot
   once. The page is intentionally separate from the delegate app. */
(function (global) {
  "use strict";

  var doc = document;
  var data = (global.ASM_DATA && global.ASM_DATA.attendance) || null;
  var slots = (data && data.slots) || [];
  var host = doc.getElementById("slotQrContent");
  var gate = doc.getElementById("slotQrGate");
  var orgApp = doc.getElementById("orgApp");
  var deskPanel = doc.getElementById("deskPanel");
  var codesPanel = doc.getElementById("codesPanel");
  var gateError = doc.getElementById("slotQrError");
  var AUTH_KEY = "asm2027.organizer";
  var PASSWORD_HASH = "702701f5829b8b7fd4b04cdcf5bab220e21e13a993c91b6b7aad0c6fd85995e4";
  var REDEEM_KEY = "asm2027.redeemed.v1";
  var REQUIRED = (data && data.required) || 7;
  var pendingStampCard = null;
  var currentTab = "desk";
  var deskScan = { active: false, stream: null, timer: 0, detector: null, canvas: null, context: null, busy: false };

  function isAuthed() {
    try { return global.sessionStorage.getItem(AUTH_KEY) === PASSWORD_HASH; } catch (e) { return false; }
  }

  function sha256(text) {
    if (!global.crypto || !global.crypto.subtle) return Promise.reject(new Error("Secure context required"));
    var bytes = new TextEncoder().encode(text);
    return global.crypto.subtle.digest("SHA-256", bytes).then(function (buffer) {
      return Array.prototype.map.call(new Uint8Array(buffer), function (b) {
        return ("0" + b.toString(16)).slice(-2);
      }).join("");
    });
  }

  function showApp() {
    if (gate) gate.hidden = true;
    if (orgApp) orgApp.hidden = false;
    route();
  }

  function boot() {
    if (isAuthed()) {
      showApp();
      return;
    }
    if (gate) gate.hidden = false;
    if (orgApp) orgApp.hidden = true;
    var unlockBtn = doc.getElementById("slotQrUnlock");
    var pwInput = doc.getElementById("slotQrPassword");
    function unlock() {
      if (gateError) gateError.hidden = true;
      sha256(pwInput ? pwInput.value : "").then(function (hash) {
        if (hash === PASSWORD_HASH) {
          try { global.sessionStorage.setItem(AUTH_KEY, PASSWORD_HASH); } catch (e) { /* ignore */ }
          showApp();
        } else if (gateError) {
          gateError.hidden = false;
        }
      }).catch(function () {
        if (gateError) {
          gateError.textContent = "This browser requires HTTPS to unlock organiser tools.";
          gateError.hidden = false;
        }
      });
    }
    if (unlockBtn) unlockBtn.addEventListener("click", unlock);
    if (pwInput) pwInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") { event.preventDefault(); unlock(); }
    });
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function payload(session) {
    return "ASM2027|STAMP|" + session.id + "|" + session.code;
  }

  function qr(session, px) {
    try {
      return global.ASMQR.svg(payload(session), {
        ecc: "M",
        border: 4,
        dark: "#123f63",
        light: "#ffffff",
        width: px,
        height: px,
        label: "Stamp QR code for " + session.title
      });
    } catch (e) {
      return '<p class="muted">QR code unavailable.</p>';
    }
  }

  /* Souvenir desk ------------------------------------------------------- */
  function storeGet(key) {
    try { return global.localStorage.getItem(key); } catch (e) { return null; }
  }
  function storeSet(key, value) {
    try { global.localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  function loadRedemptions() {
    var raw = storeGet(REDEEM_KEY);
    if (!raw) return [];
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }

  function saveRedemptions(list) {
    storeSet(REDEEM_KEY, JSON.stringify(list));
  }

  function fmtTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso || "";
    return d.toLocaleString();
  }

  function sessionMaps() {
    var sessions = {}, slotMap = {};
    ((global.ASM_DATA && global.ASM_DATA.sessions) || []).forEach(function (s) { sessions[s.id] = s; });
    slots.forEach(function (s) { slotMap[s.id] = s; });
    return { sessions: sessions, slots: slotMap };
  }

  function parseStampCard(raw) {
    var parts = String(raw || "").split("|");
    if (parts.length < 6 || parts[0] !== "ASM2027" || parts[1] !== "STAMPCARD") return null;
    var device = parts[2] || "";
    var claim = parts[3] === "-" ? "" : (parts[3] || "");
    var progress = parts[4] || "";
    var list = parts[5] || "";
    var bits = progress.split("/");
    var done = parseInt(bits[0], 10);
    var total = parseInt(bits[1], 10);
    if (!device || !progress || isNaN(done) || isNaN(total)) return null;
    var sessions = list ? list.split(",").map(function (pair) {
      var p = pair.split(":");
      return { slotId: p[0], sessionId: p[1] };
    }) : [];
    return { device: device, claim: claim, done: done, total: total, sessions: sessions };
  }

  function findRedeemed(card) {
    return loadRedemptions().filter(function (r) {
      return r.device === card.device || (card.claim && r.claim === card.claim);
    })[0] || null;
  }

  function sessionListHtml(card) {
    var maps = sessionMaps();
    if (!card.sessions.length) return '<p class="desk-log-empty">No sessions listed on this card.</p>';
    return '<ul class="desk-sessions">' + card.sessions.map(function (item) {
      var session = maps.sessions[item.sessionId];
      var slot = maps.slots[item.slotId];
      return "<li><strong>" + esc(session ? session.title : item.sessionId) + "</strong><span>" +
        esc(slot ? slot.label + " · " + slot.time : item.slotId) +
        (session ? " · " + esc(session.room) : "") + "</span></li>";
    }).join("") + "</ul>";
  }

  function renderDeskResult(html, kind) {
    var box = doc.getElementById("deskResult");
    if (!box) return;
    box.className = "desk-result" + (kind ? " " + kind : "");
    box.innerHTML = html;
  }

  function handleStampCard(raw) {
    var card = parseStampCard(raw);
    if (!card) {
      pendingStampCard = null;
      renderDeskResult('<p class="desk-kicker">Invalid code</p><h2>Not a stamp card</h2><p>This QR is not a valid ' + esc((global.ASM_DATA.meta.event.shortName) || "") + ' stamp card.</p>', "is-bad");
      return;
    }
    var existing = findRedeemed(card);
    if (existing) {
      pendingStampCard = null;
      renderDeskResult(
        '<p class="desk-kicker">Already redeemed</p>' +
        '<h2>Do not issue another souvenir</h2>' +
        '<p><strong>' + esc(card.done) + "/" + esc(card.total) + "</strong> slot stamps. Claim code: <strong>" + esc(card.claim || "—") + "</strong></p>" +
        '<p>Recorded at <strong>' + esc(fmtTime(existing.at)) + "</strong>.</p>" +
        '<p class="desk-device">Device: ' + esc(card.device) + "</p>",
        "is-bad"
      );
      return;
    }
    if (!card.claim || card.done < REQUIRED) {
      pendingStampCard = null;
      renderDeskResult(
        '<p class="desk-kicker">Not eligible</p>' +
        '<h2>Do not issue a souvenir yet</h2>' +
        '<p><strong>' + esc(card.done) + "/" + esc(card.total) + "</strong> slot stamps. The delegate needs at least <strong>" + REQUIRED + "</strong>.</p>" +
        (card.claim ? '<p>Claim code: <strong>' + esc(card.claim) + "</strong></p>" : '<p>No souvenir claim code is present.</p>') +
        sessionListHtml(card) +
        '<p class="desk-device">Device: ' + esc(card.device) + "</p>",
        "is-no"
      );
      return;
    }
    pendingStampCard = card;
    renderDeskResult(
      '<p class="desk-kicker">Eligible</p>' +
      '<h2>Issue the souvenir</h2>' +
      '<p><strong>' + esc(card.done) + "/" + esc(card.total) + "</strong> slot stamps. Claim code: <strong>" + esc(card.claim) + "</strong></p>" +
      sessionListHtml(card) +
      '<p class="desk-device">Device: ' + esc(card.device) + "</p>" +
      '<button class="btn btn-primary" type="button" data-act="recordRedemption">Record and give souvenir</button>',
      "is-ok"
    );
  }

  function recordRedemption() {
    if (!pendingStampCard) return;
    var list = loadRedemptions();
    list.unshift({
      at: new Date().toISOString(),
      device: pendingStampCard.device,
      claim: pendingStampCard.claim,
      done: pendingStampCard.done,
      total: pendingStampCard.total,
      sessions: pendingStampCard.sessions
    });
    saveRedemptions(list);
    renderLog();
    var card = pendingStampCard;
    pendingStampCard = null;
    renderDeskResult(
      '<p class="desk-kicker">Recorded</p>' +
      '<h2>Souvenir issued</h2>' +
      '<p>Claim code <strong>' + esc(card.claim) + "</strong> has been recorded on this phone.</p>" +
      '<p class="desk-device">Device: ' + esc(card.device) + "</p>",
      "is-ok"
    );
  }

  function renderLog() {
    var wrap = doc.getElementById("deskLogWrap");
    var empty = doc.getElementById("deskLogEmpty");
    if (!wrap || !empty) return;
    var list = loadRedemptions();
    empty.hidden = list.length > 0;
    wrap.hidden = list.length === 0;
    if (!list.length) { wrap.innerHTML = ""; return; }
    wrap.innerHTML = '<div class="table-wrap"><table class="desk-log-table"><thead><tr><th>Time</th><th>Claim code</th><th>Stamps</th><th>Device</th></tr></thead><tbody>' +
      list.map(function (r) {
        return "<tr><td>" + esc(fmtTime(r.at)) + "</td><td>" + esc(r.claim || "—") + "</td><td>" + esc((r.done || 0) + "/" + (r.total || 8)) + "</td><td class=\"desk-device\">" + esc(r.device) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  /* Desk camera scanner ------------------------------------------------ */
  function deskSetHint(message) {
    var hint = doc.getElementById("deskHint");
    if (hint) hint.textContent = message;
  }

  function startDeskScan() {
    if (!global.navigator.mediaDevices || !global.navigator.mediaDevices.getUserMedia) {
      deskSetHint("This browser cannot open the camera.");
      return;
    }
    stopDeskScan();
    deskSetHint("Requesting the camera…");
    global.navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then(function (stream) {
        deskScan.stream = stream;
        deskScan.active = true;
        var video = doc.getElementById("deskVideo");
        if (!video) { stopDeskScan(); return; }
        video.srcObject = stream;
        video.setAttribute("playsinline", "");
        video.muted = true;
        var play = video.play();
        if (play && play.catch) play.catch(function () {});
        deskScan.canvas = doc.createElement("canvas");
        deskScan.context = deskScan.canvas.getContext("2d", { willReadFrequently: true });
        deskSetHint("Point the camera at the delegate's stamp-card QR.");
        var stopButton = doc.querySelector('[data-act="stopDeskScan"]');
        var startButton = doc.querySelector('[data-act="startDeskScan"]');
        if (stopButton) stopButton.hidden = false;
        if (startButton) startButton.hidden = true;
        setupDeskDetector();
        deskTick();
      }).catch(function (error) {
        var reason = error && error.name === "NotAllowedError" ? "Camera permission was blocked." : "The camera is not available.";
        deskSetHint(reason);
      });
  }

  function setupDeskDetector() {
    deskScan.detector = null;
    try {
      if (!global.BarcodeDetector) return;
      global.BarcodeDetector.getSupportedFormats().then(function (formats) {
        if (formats.indexOf("qr_code") !== -1) {
          deskScan.detector = new global.BarcodeDetector({ formats: ["qr_code"] });
        }
      }).catch(function () {});
    } catch (e) { deskScan.detector = null; }
  }

  function stopDeskScan() {
    deskScan.active = false;
    deskScan.busy = false;
    if (deskScan.timer) { global.clearTimeout(deskScan.timer); deskScan.timer = 0; }
    if (deskScan.stream) {
      deskScan.stream.getTracks().forEach(function (track) { track.stop(); });
      deskScan.stream = null;
    }
    var video = doc.getElementById("deskVideo");
    if (video) video.srcObject = null;
    var stopButton = doc.querySelector('[data-act="stopDeskScan"]');
    var startButton = doc.querySelector('[data-act="startDeskScan"]');
    if (stopButton) stopButton.hidden = true;
    if (startButton) startButton.hidden = false;
  }

  function deskTick() {
    if (!deskScan.active) return;
    var video = doc.getElementById("deskVideo");
    if (video && video.readyState >= 2 && !deskScan.busy) {
      deskScan.busy = true;
      deskDetect(video).then(function () { deskScan.busy = false; }, function () { deskScan.busy = false; });
    }
    deskScan.timer = global.setTimeout(deskTick, 240);
  }

  function deskDetect(video) {
    if (deskScan.detector) {
      return deskScan.detector.detect(video).then(function (codes) {
        if (codes && codes.length && codes[0].rawValue) deskOnCode(codes[0].rawValue);
      }).catch(function () {
        deskScan.detector = null;
        return deskDetectJsQr(video);
      });
    }
    return Promise.resolve(deskDetectJsQr(video));
  }

  function deskDetectJsQr(video) {
    if (!global.jsQR || !deskScan.context) return;
    var width = video.videoWidth, height = video.videoHeight;
    if (!width || !height) return;
    var scale = Math.min(1, 720 / Math.max(width, height));
    deskScan.canvas.width = Math.round(width * scale);
    deskScan.canvas.height = Math.round(height * scale);
    deskScan.context.drawImage(video, 0, 0, deskScan.canvas.width, deskScan.canvas.height);
    var image = deskScan.context.getImageData(0, 0, deskScan.canvas.width, deskScan.canvas.height);
    var code = global.jsQR(image.data, image.width, image.height);
    if (code && code.data) deskOnCode(code.data);
  }

  function deskOnCode(raw) {
    stopDeskScan();
    deskSetHint("Stamp card scanned.");
    handleStampCard(raw);
  }

  function sessionCard(slot, session) {
    return '<article class="slotqr-session" id="sess-' + esc(session.id) + '">' +
      '<div class="slotqr-session-code">' + qr(session, 132) + '</div>' +
      '<div class="slotqr-session-main">' +
        '<span class="detail-type">' + esc(slot.label) + ' &middot; ' + esc(slot.time) + '</span>' +
        '<h4>' + esc(session.title) + '</h4>' +
        '<p>' + esc(session.room) + '</p>' +
        '<p class="slotqr-code">' + esc(session.code) + '</p>' +
        '<a href="#display/' + esc(session.id) + '">Open display mode &rarr;</a>' +
      '</div>' +
    '</article>';
  }

  function renderList() {
    if (!host) return;
    if (!slots.length) {
      host.innerHTML = '<h1 class="section-title">Slot QR codes</h1><p class="muted">No slot data is available.</p>';
      return;
    }
    var days = [];
    slots.forEach(function (slot) {
      var day = days.filter(function (d) { return d.id === slot.day; })[0];
      if (!day) { var em = (global.ASM_DATA && global.ASM_DATA.meta && global.ASM_DATA.meta.event) || {}; day = { id: slot.day, label: slot.day === "day1" ? "Day 1 — " + (em.day1Long || "") : "Day 2 — " + (em.day2Long || ""), slots: [] }; days.push(day); }
      day.slots.push(slot);
    });

    host.innerHTML =
      '<div class="slotqr-page-head">' +
        '<div><p class="breadcrumb"><a href="../index.html">Home</a><span>/</span>Organiser tools <span>/</span> Slot QR codes</p>' +
        '<h1 class="section-title">Slot QR codes</h1>' +
        '<p class="lede">One QR code per session, symposium and workshop. Scan any code in a slot to collect that slot\'s stamp.</p></div>' +
        '<div class="slotqr-actions"><button class="btn btn-primary" type="button" data-act="print">Print all codes</button>' +
        '<button class="btn btn-secondary" type="button" data-act="lock">Lock</button>' +
        '<a class="btn btn-secondary" href="app.html#/stamps">Open Stamp Collection</a></div>' +
      '</div>' +
      '<div class="callout"><p><strong>Room display:</strong> open a session in display mode on the room screen. The same session code can be shown in every room used by that session. Parallel sessions share a slot, so a delegate only receives one stamp for the slot.</p></div>' +
      days.map(function (day) {
        return '<h2 class="slotqr-day">' + esc(day.label) + '</h2>' +
          day.slots.map(function (slot) {
            return '<section class="slotqr-slot">' +
              '<h3>' + esc(slot.label) + ' &middot; ' + esc(slot.time) + '</h3>' +
              '<p>' + (slot.sessions || []).length + ' parallel session' + ((slot.sessions || []).length === 1 ? "" : "s") + '</p>' +
              '<div class="slotqr-session-grid">' +
                (slot.sessions || []).map(function (session) { return sessionCard(slot, session); }).join("") +
              '</div>' +
            '</section>';
          }).join("");
      }).join("");
  }

  function findSession(id) {
    for (var i = 0; i < slots.length; i++) {
      var list = slots[i].sessions || [];
      for (var j = 0; j < list.length; j++) {
        if (list[j].id === id) return { slot: slots[i], session: list[j] };
      }
    }
    return null;
  }

  function renderDisplay(id) {
    if (!host) return;
    var found = findSession(id);
    if (!found) {
      host.innerHTML = '<h1 class="section-title">Session QR code</h1><p class="muted">That session was not found.</p><p><a class="btn btn-secondary" href="#all">All session QR codes</a></p>';
      return;
    }
    var slot = found.slot, session = found.session;
    var rooms = (slot.sessions || []).map(function (s) {
      return '<li><strong>' + esc(s.title) + '</strong> &middot; ' + esc(s.room) + '</li>';
    }).join("");
    host.innerHTML =
      '<div class="slotqr-display">' +
        '<p class="detail-type">' + esc((global.ASM_DATA.meta.event.shortName) || "") + ' &middot; Stamp Collection</p>' +
        '<h1>' + esc(session.title) + '</h1>' +
        '<p class="slotqr-when">' + esc(slot.label) + ' &middot; ' + esc(slot.time) + ' &middot; ' + esc(session.room) + '</p>' +
        '<div class="slotqr-big">' + qr(session, 640) + '</div>' +
        '<p class="slotqr-scanline"><strong>Scan with the ' + esc((global.ASM_DATA.meta.event.shortName) || "") + ' app</strong></p>' +
        '<p class="muted">This stamp counts for ' + esc(slot.label) + '. Parallel sessions in the same slot share one stamp.</p>' +
        '<ul class="slotqr-rooms">' + rooms + '</ul>' +
        '<p class="slotqr-code">Code: ' + esc(session.code) + '</p>' +
        '<div class="slotqr-actions" style="justify-content:center">' +
          '<button class="btn btn-primary" type="button" data-act="print">Print this code</button>' +
          '<a class="btn btn-secondary" href="#all">All session QR codes</a>' +
        '</div>' +
      '</div>';
  }

  function setTab(tab) {
    currentTab = tab === "codes" ? "codes" : "desk";
    if (deskPanel) deskPanel.hidden = currentTab !== "desk";
    if (codesPanel) codesPanel.hidden = currentTab !== "codes";
    Array.prototype.forEach.call(doc.querySelectorAll("[data-tab]"), function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-tab") === currentTab ? "true" : "false");
    });
    if (currentTab !== "desk") stopDeskScan();
  }

  function route() {
    var hash = global.location.hash.replace(/^#\/?/, "");
    if (hash.indexOf("display/") === 0) {
      setTab("codes");
      renderDisplay(decodeURIComponent(hash.slice("display/".length)));
      return;
    }
    if (hash === "codes" || hash === "all") {
      setTab("codes");
      renderList();
      return;
    }
    setTab("desk");
    renderLog();
  }

  function exportLog() {
    var list = loadRedemptions();
    if (!list.length) { global.alert("No souvenirs recorded yet."); return; }
    function cell(v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }
    var rows = [["Time", "Claim code", "Stamps", "Device", "Sessions"].map(cell).join(",")];
    list.forEach(function (r) {
      var sessions = (r.sessions || []).map(function (s) { return s.slotId + ":" + s.sessionId; }).join(" ");
      rows.push([fmtTime(r.at), r.claim || "", (r.done || 0) + "/" + (r.total || 8), r.device || "", sessions].map(cell).join(","));
    });
    var blob = new Blob([rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = doc.createElement("a");
    a.href = url;
    a.download = "asm2027-souvenir-redemptions.csv";
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    global.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  doc.addEventListener("click", function (event) {
    var tabButton = event.target.closest("[data-tab]");
    if (tabButton) {
      setTab(tabButton.getAttribute("data-tab"));
      global.location.hash = tabButton.getAttribute("data-tab") === "codes" ? "#codes" : "#desk";
      return;
    }
    var button = event.target.closest("[data-act]");
    if (!button) return;
    var act = button.getAttribute("data-act");
    if (act === "print") global.print();
    if (act === "startDeskScan") startDeskScan();
    if (act === "stopDeskScan") { stopDeskScan(); deskSetHint("Camera stopped."); }
    if (act === "recordRedemption") recordRedemption();
    if (act === "exportDeskLog") exportLog();
    if (act === "clearDeskLog") {
      if (!global.confirm("Clear the souvenir redemption log on this phone? This cannot be undone.")) return;
      saveRedemptions([]);
      renderLog();
    }
    if (act === "lock") {
      stopDeskScan();
      try { global.sessionStorage.removeItem(AUTH_KEY); } catch (e) { /* ignore */ }
      if (orgApp) orgApp.hidden = true;
      if (gate) gate.hidden = false;
      var pw = doc.getElementById("slotQrPassword");
      if (pw) pw.value = "";
      if (gateError) gateError.hidden = true;
    }
  });
  global.addEventListener("hashchange", route);
  boot();
  global.ASMOrganizer = {
    handleStampCard: handleStampCard,
    recordRedemption: recordRedemption,
    loadRedemptions: loadRedemptions
  };
})(typeof window !== "undefined" ? window : this);
