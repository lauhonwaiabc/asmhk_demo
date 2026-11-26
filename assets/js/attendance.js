/* ASM 2027 event app — Stamp Collection
   Every symposium, session and workshop has its own QR code. Several
   sessions share a slot, so a delegate can only collect one stamp per slot.
   The eight eligible slots are Day 1 Sessions 1–4 and Day 2 Sessions 5–8.

   Prototype note: this is a local-first verifier for the event app. For
   production, issue signed, expiring session tokens from the server and post
   each scan to the registration backend so attendance can be audited and the
   souvenir desk can verify eligibility. */
(function (global) {
  "use strict";

  var doc = document;
  var KEY = "asm2027.attendance.v1";
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  var ctx = {
    show: function () {},
    toast: function () {},
    esc: function (value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
  };

  var els = {};
  var state = {
    loaded: false,
    slots: [],
    byId: {},
    sessionById: {},
    sessionByCode: {},
    required: 7,
    total: 8,
    reward: "Complimentary souvenir",
    records: {},
    claimCode: ""
  };
  var scan = {
    active: false,
    stream: null,
    timer: 0,
    detector: null,
    canvas: null,
    context: null,
    busy: false
  };
  var wakeLock = null;

  /* Helpers -------------------------------------------------------------- */
  function esc(value) { return ctx.esc(value); }

  function clean(value, max) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max || 200);
  }

  function storeGet(key) {
    try { return global.localStorage.getItem(key); } catch (e) { return null; }
  }

  function storeSet(key, value) {
    try { global.localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  function storeRemove(key) {
    try { global.localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  function stampData() {
    return (global.ASM_DATA && global.ASM_DATA.attendance) || null;
  }

  function load() {
    var data = stampData();
    state.slots = (data && data.slots) || [];
    state.required = (data && data.required) || 7;
    state.total = (data && data.total) || state.slots.length || 8;
    state.reward = (data && data.reward) || "Complimentary souvenir";
    state.byId = {};
    state.sessionById = {};
    state.sessionByCode = {};
    state.slots.forEach(function (slot) {
      state.byId[slot.id] = slot;
      (slot.sessions || []).forEach(function (session) {
        var entry = { session: session, slot: slot };
        state.sessionById[session.id] = entry;
        state.sessionByCode[String(session.code || "").toUpperCase()] = entry;
      });
    });

    var parsed = null;
    var raw = storeGet(KEY);
    if (raw) {
      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    }
    state.records = {};
    state.claimCode = "";
    if (parsed && parsed.records && typeof parsed.records === "object") {
      Object.keys(parsed.records).forEach(function (id) {
        if (state.byId[id] && parsed.records[id]) state.records[id] = parsed.records[id];
      });
    }
    if (parsed && typeof parsed.claimCode === "string") state.claimCode = parsed.claimCode;
    state.loaded = true;
  }

  function ensure() {
    if (!state.loaded) load();
  }

  function save() {
    storeSet(KEY, JSON.stringify({
      v: 1,
      records: state.records,
      claimCode: state.claimCode,
      updatedAt: new Date().toISOString()
    }));
  }

  function doneCount() {
    ensure();
    return Object.keys(state.records).filter(function (id) { return !!state.byId[id]; }).length;
  }

  function eligible() {
    return doneCount() >= state.required;
  }

  function claimCode() {
    ensure();
    if (!eligible()) return "";
    if (!state.claimCode) {
      state.claimCode = "SOUV-" + randomCode(6);
      save();
    }
    return state.claimCode;
  }

  function progress() {
    ensure();
    return {
      done: doneCount(),
      total: state.total,
      required: state.required,
      eligible: eligible(),
      reward: state.reward,
      claimCode: claimCode()
    };
  }

  function randomCode(length) {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var out = "";
    try {
      var bytes = new Uint8Array(length);
      global.crypto.getRandomValues(bytes);
      for (var i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
      return out;
    } catch (e) {
      for (var j = 0; j < length; j++) out += chars[Math.floor(Math.random() * chars.length)];
      return out;
    }
  }

  var cachedDeviceId = null;
  var DEVICE_KEY = "asm2027.device.v1";

  function deviceId() {
    if (cachedDeviceId) return cachedDeviceId;
    var id = storeGet(DEVICE_KEY);
    if (!id) {
      try {
        id = global.crypto && global.crypto.randomUUID
          ? global.crypto.randomUUID()
          : "dev-" + Date.now().toString(36) + "-" + randomCode(10).toLowerCase();
      } catch (e) {
        id = "dev-" + Date.now().toString(36) + "-" + randomCode(10).toLowerCase();
      }
      storeSet(DEVICE_KEY, id);
    }
    cachedDeviceId = id;
    return id;
  }

  function fmtWhen(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var mins = String(d.getMinutes()).padStart(2, "0");
    return d.getDate() + " " + MONTHS[d.getMonth()] + ", " + d.getHours() + ":" + mins;
  }

  function slotShort(slot) {
    var rooms = (slot.sessions || []).map(function (s) { return s.room; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    return rooms.join(" · ");
  }

  function stampCardPayload() {
    var p = progress();
    var list = state.slots.filter(function (slot) { return !!state.records[slot.id]; }).map(function (slot) {
      return slot.id + ":" + state.records[slot.id].sessionId;
    }).join(",");
    return "ASM2027|STAMPCARD|" + deviceId() + "|" + (p.claimCode || "-") + "|" + p.done + "/" + p.total + "|" + list;
  }

  function stampQrHtml() {
    if (!global.ASMQR) return "";
    try {
      return global.ASMQR.svg(stampCardPayload(), {
        ecc: "M", border: 4, dark: "#123f63", light: "#ffffff",
        width: 300, height: 300, label: "ASM 2027 stamp card QR code"
      });
    } catch (e) {
      return '<p class="app-hint">The stamp card QR code could not be generated.</p>';
    }
  }

  /* Parsing and recording ------------------------------------------------ */
  function parsePayload(raw) {
    var text = String(raw || "").trim();
    if (!text) return null;

    /* Compact payload: ASM2027|STAMP|<sessionId>|<code> */
    var parts = text.split("|");
    if (parts.length >= 4 &&
        parts[0].toUpperCase() === "ASM2027" &&
        (parts[1].toUpperCase() === "STAMP" || parts[1].toUpperCase() === "ATTEND")) {
      return { sessionId: parts[2].toLowerCase(), code: parts[3].toUpperCase() };
    }

    /* URL payload: ...#/stamps?session=plen&code=K7Q2 */
    var sessionMatch = text.match(/[?&#]session=([a-z0-9-]+)/i);
    var codeMatch = text.match(/[?&#]code=([a-z0-9]+)/i);
    if (sessionMatch) return { sessionId: sessionMatch[1].toLowerCase(), code: codeMatch ? codeMatch[1].toUpperCase() : "" };

    /* Manual formats: plen, K7Q2, plen:K7Q2, plen-K7Q2 */
    var manual = text.match(/^([a-z0-9-]+?)(?:[\s:_-]+([A-Z0-9]{4}))?$/i);
    if (manual) {
      var key = manual[1].toLowerCase();
      if (state.sessionById[key]) return { sessionId: key, code: manual[2] ? manual[2].toUpperCase() : "" };
    }

    /* A bare four-character session code. */
    var bare = text.match(/^([A-Z0-9]{4})$/i);
    if (bare) {
      var found = state.sessionByCode[bare[1].toUpperCase()];
      if (found) return { sessionId: found.session.id, code: found.session.code };
    }
    return null;
  }

  function resolve(raw) {
    ensure();
    var parsed = parsePayload(raw);
    if (!parsed) return { status: "invalid", message: "This is not an ASM 2027 stamp code." };
    var found = state.sessionById[parsed.sessionId];
    if (!found) return { status: "invalid", message: "This session is not part of the Stamp Collection." };
    var session = found.session;
    var slot = found.slot;
    if (parsed.code && String(session.code || "").toUpperCase() !== parsed.code) {
      return { status: "invalid", message: "The stamp code is not valid. Ask the room host for the current QR code." };
    }
    if (state.records[slot.id]) {
      return {
        status: "duplicate",
        slot: slot,
        session: session,
        record: state.records[slot.id],
        progress: progress()
      };
    }
    state.records[slot.id] = {
      at: new Date().toISOString(),
      slotId: slot.id,
      sessionId: session.id,
      sessionTitle: session.title,
      title: slot.label
    };
    save();
    return {
      status: "new",
      slot: slot,
      session: session,
      record: state.records[slot.id],
      progress: progress()
    };
  }

  /* Stamp dashboard ------------------------------------------------------ */
  function renderDashboard() {
    if (!els.attendance) return;
    ensure();
    var p = progress();
    var pct = Math.min(100, Math.round(p.done / p.total * 100));
    var remaining = Math.max(0, p.required - p.done);
    var statusHtml = p.eligible
      ? '<div class="attendance-reward is-unlocked">' +
          '<span class="attendance-reward-kicker">Souvenir unlocked</span>' +
          '<strong>' + esc(p.reward) + '</strong>' +
          '<p>Show this claim code at the souvenir desk:</p>' +
          '<span class="attendance-claim">' + esc(p.claimCode) + '</span>' +
        '</div>'
      : '<div class="attendance-reward">' +
          '<span class="attendance-reward-kicker">' + (remaining === 1 ? "1 stamp to go" : remaining + " stamps to go") + '</span>' +
          '<strong>' + esc(p.reward) + '</strong>' +
          '<p>Collect at least ' + p.required + ' of the ' + p.total + ' slot stamps. Lunch symposia and ceremonies do not count.</p>' +
        '</div>';

    var attendedRows = state.slots.filter(function (slot) { return !!state.records[slot.id]; }).map(function (slot) {
      var rec = state.records[slot.id];
      var entry = state.sessionById[rec.sessionId];
      var session = entry ? entry.session : null;
      return '<article class="stamp-attended">' +
        "<strong>" + esc(rec.sessionTitle || (session ? session.title : "Session")) + "</strong>" +
        "<span>" + esc(slot.label) + " &middot; " + esc(slot.time) +
          (session ? " &middot; " + esc(session.room) : "") + "</span>" +
        "<small>Stamped " + esc(fmtWhen(rec.at)) + "</small>" +
      "</article>";
    }).join("");

    var rows = state.slots.map(function (slot) {
      var rec = state.records[slot.id];
      var entry = rec ? state.sessionById[rec.sessionId] : null;
      var session = entry ? entry.session : null;
      var sessions = (slot.sessions || []).map(function (s) {
        return '<li><strong>' + esc(s.title) + '</strong><span>' + esc(s.room) + '</span></li>';
      }).join("");
      return '<article class="attendance-slot' + (rec ? " is-done" : "") + '">' +
        '<span class="attendance-check" aria-hidden="true">' + (rec
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg>'
          : '<span>' + esc(slot.id.slice(-1)) + '</span>') + '</span>' +
        '<div class="attendance-slot-main">' +
          '<div class="attendance-slot-head"><strong>' + esc(slot.label) + '</strong>' +
            '<span>' + esc(slot.time) + '</span></div>' +
          '<p class="attendance-slot-meta">' + esc(slotShort(slot)) + '</p>' +
          (rec && rec.sessionTitle
            ? '<p class="attendance-slot-stamp">Attended: <strong>' + esc(rec.sessionTitle) + '</strong>' +
              (session ? ' &middot; ' + esc(session.room) : "") + '</p>'
            : "") +
          '<details class="attendance-slot-details"><summary>Parallel sessions</summary><ul>' + sessions + '</ul></details>' +
        '</div>' +
        '<span class="attendance-slot-state">' + (rec ? "Stamped<br><small>" + esc(fmtWhen(rec.at)) + "</small>" : "No stamp") + '</span>' +
      '</article>';
    }).join("");

    els.attendance.innerHTML =
      '<h1 class="app-title" id="title-attendance">Stamp Collection</h1>' +
      '<p class="app-subtitle">Collect 7 of 8 slot stamps across Day 1 and Day 2</p>' +
      '<div class="attendance-hero">' +
        '<div class="attendance-score">' +
          '<strong>' + p.done + '</strong><span>of ' + p.total + ' stamps</span>' +
        '</div>' +
        '<div class="attendance-hero-main">' +
          '<div class="attendance-progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + p.total + '" aria-valuenow="' + p.done + '" aria-label="Stamp collection progress">' +
            '<span style="width:' + pct + '%"></span>' +
          '</div>' +
          '<p>' + (p.eligible ? "Full stamp card — your souvenir is unlocked." : "Collect " + p.required + " of " + p.total + " slot stamps to unlock the souvenir.") + '</p>' +
        '</div>' +
      '</div>' +
      statusHtml +
      '<div class="attendance-actions">' +
        '<a class="app-btn" href="#/stamps/scan">Scan a stamp QR code</a>' +
      '</div>' +
      (p.eligible
        ? '<div class="stamp-qr-card">' +
            '<h2>My stamp card QR</h2>' +
            '<p>Show this at the souvenir desk. Staff can scan it to see your stamp progress and the sessions you attended.</p>' +
            '<button class="app-btn app-btn--ghost stamp-qr-toggle" type="button" data-act="toggleStampQr" aria-expanded="false" aria-controls="stampQrPanel">Show QR code</button>' +
            '<div class="stamp-qr-panel" id="stampQrPanel" hidden>' +
              '<div class="stamp-qr-box">' + stampQrHtml() + '</div>' +
              '<p class="stamp-qr-claim">' + (p.claimCode
                ? 'Claim code: <strong>' + esc(p.claimCode) + '</strong>'
                : 'Not yet eligible for the souvenir') + '</p>' +
              '<p class="stamp-qr-device">Device ID: <code>' + esc(deviceId()) + '</code></p>' +
            '</div>' +
          '</div>'
        : '') +
      '<h2 class="app-group-title">Attended sessions</h2>' +
      (attendedRows
        ? '<div class="stamp-attended-list">' + attendedRows + '</div>'
        : '<p class="app-hint">No sessions attended yet.</p>') +
      '<h2 class="app-group-title">Slot stamps</h2>' +
      '<div class="attendance-list">' + rows + '</div>' +
      '<div class="attendance-foot">' +
        '<p class="app-hint">Every session has its own QR code, but parallel sessions in the same slot give only one stamp. The first scan in a slot is the one recorded.</p>' +
        '<button class="attendance-reset" type="button" data-act="resetAttendance">Reset my stamp collection on this device</button>' +
      '</div>';
  }

  /* Scanner -------------------------------------------------------------- */
  function renderScan() {
    if (!els.scan) return;
    stopScan();
    var p = progress();
    els.scan.innerHTML =
      '<h1 class="app-title" id="title-attendance-scan">Scan a stamp</h1>' +
      '<p class="app-subtitle">' + p.done + ' of ' + p.total + ' slot stamps collected</p>' +
      '<div class="scan-stage">' +
        '<video class="scan-video" id="attendanceVideo" playsinline muted aria-label="Camera preview"></video>' +
        '<div class="scan-frame" aria-hidden="true"></div>' +
        '<p class="scan-hint" id="attendanceScanHint" role="status">Tap Start camera, then point it at the QR code for your session.</p>' +
      '</div>' +
      '<div class="attendance-scan-actions">' +
        '<button class="app-btn" type="button" data-act="startSlotScan">Start camera</button>' +
        '<button class="app-btn app-btn--ghost" type="button" data-act="stopSlotScan" hidden>Stop</button>' +
      '</div>' +
      '<div id="attendanceScanResult"></div>' +
      '<details class="scan-fallback">' +
        '<summary>Camera not working? Enter the session code</summary>' +
        '<label class="field"><span>Session ID or code (for example plen or K7Q2)</span>' +
          '<input id="attendanceCode" type="text" inputmode="text" autocomplete="off" placeholder="plen"></label>' +
        '<button class="app-btn app-btn--ghost" type="button" data-act="manualSlot">Collect this stamp</button>' +
      '</details>' +
      '<p class="app-hint">Each session has its own QR code. The stamp card counts the slot, not the room.</p>';
    bindScanControls();
  }

  function setHint(message) {
    var hint = doc.getElementById("attendanceScanHint");
    if (hint) hint.textContent = message;
  }

  function bindScanControls() {
    var input = doc.getElementById("attendanceCode");
    if (input) {
      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          manualCheckIn(input.value);
        }
      });
    }
  }

  function startScan() {
    if (!global.navigator.mediaDevices || !global.navigator.mediaDevices.getUserMedia) {
      setHint("This browser cannot open the camera. Use the session-code option below.");
      return;
    }
    stopScan();
    setHint("Requesting the camera…");
    global.navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    }).then(function (stream) {
      scan.stream = stream;
      scan.active = true;
      var video = doc.getElementById("attendanceVideo");
      if (!video) { stopScan(); return; }
      video.srcObject = stream;
      video.setAttribute("playsinline", "");
      video.muted = true;
      var play = video.play();
      if (play && play.catch) play.catch(function () {});
      scan.canvas = doc.createElement("canvas");
      scan.context = scan.canvas.getContext("2d", { willReadFrequently: true });
      setHint("Point the camera at the session QR code.");
      var stopButton = doc.querySelector('[data-act="stopSlotScan"]');
      var startButton = doc.querySelector('[data-act="startSlotScan"]');
      if (stopButton) stopButton.hidden = false;
      if (startButton) startButton.hidden = true;
      setupDetector();
      tick();
    }).catch(function (error) {
      var reason = error && error.name === "NotAllowedError" ? "Camera permission was blocked." : "The camera is not available.";
      setHint(reason + " Use the session-code option below.");
    });
  }

  function setupDetector() {
    scan.detector = null;
    try {
      if (!global.BarcodeDetector) return;
      global.BarcodeDetector.getSupportedFormats().then(function (formats) {
        if (formats.indexOf("qr_code") !== -1) {
          scan.detector = new global.BarcodeDetector({ formats: ["qr_code"] });
        }
      }).catch(function () {});
    } catch (e) { scan.detector = null; }
  }

  function stopScan() {
    scan.active = false;
    scan.busy = false;
    if (scan.timer) { global.clearTimeout(scan.timer); scan.timer = 0; }
    if (scan.stream) {
      scan.stream.getTracks().forEach(function (track) { track.stop(); });
      scan.stream = null;
    }
    var video = doc.getElementById("attendanceVideo");
    if (video) video.srcObject = null;
    var stopButton = doc.querySelector('[data-act="stopSlotScan"]');
    var startButton = doc.querySelector('[data-act="startSlotScan"]');
    if (stopButton) stopButton.hidden = true;
    if (startButton) startButton.hidden = false;
  }

  function tick() {
    if (!scan.active) return;
    var video = doc.getElementById("attendanceVideo");
    if (video && video.readyState >= 2 && !scan.busy) {
      scan.busy = true;
      detectFrame(video).then(function () { scan.busy = false; }, function () { scan.busy = false; });
    }
    scan.timer = global.setTimeout(tick, 240);
  }

  function detectFrame(video) {
    if (scan.detector) {
      return scan.detector.detect(video).then(function (codes) {
        if (codes && codes.length && codes[0].rawValue) onCode(codes[0].rawValue);
      }).catch(function () {
        scan.detector = null;
        return detectWithJsQr(video);
      });
    }
    return Promise.resolve(detectWithJsQr(video));
  }

  function detectWithJsQr(video) {
    if (!global.jsQR || !scan.context) return;
    var width = video.videoWidth, height = video.videoHeight;
    if (!width || !height) return;
    var scale = Math.min(1, 720 / Math.max(width, height));
    scan.canvas.width = Math.round(width * scale);
    scan.canvas.height = Math.round(height * scale);
    scan.context.drawImage(video, 0, 0, scan.canvas.width, scan.canvas.height);
    var image = scan.context.getImageData(0, 0, scan.canvas.width, scan.canvas.height);
    var code = global.jsQR(image.data, image.width, image.height);
    if (code && code.data) onCode(code.data);
  }

  function onCode(raw) {
    stopScan();
    var result = resolve(raw);
    showResult(result);
  }

  function manualCheckIn(value) {
    var text = clean(value, 120);
    if (!text) { setHint("Enter the session ID or code shown in the room."); return; }
    var result = resolve(text);
    showResult(result);
  }

  function showResult(result) {
    var box = doc.getElementById("attendanceScanResult");
    if (!box) return;
    if (result.status === "invalid") {
      setHint("That code was not recognised.");
      box.innerHTML = '<div class="attendance-result is-invalid">' +
        '<span class="attendance-result-kicker">Not recognised</span>' +
        '<p>' + esc(result.message) + '</p>' +
        '<button class="app-btn app-btn--ghost" type="button" data-act="startSlotScan">Try again</button>' +
      '</div>';
      return;
    }
    var p = result.progress;
    var slot = result.slot;
    var session = result.session;
    if (result.status === "duplicate") {
      setHint("This slot already has a stamp.");
      box.innerHTML = '<div class="attendance-result is-duplicate">' +
        '<span class="attendance-result-kicker">Already stamped</span>' +
        '<strong>' + esc(slot.label) + '</strong>' +
        '<p>' + esc(session.title) + ' · ' + esc(session.room) + '</p>' +
        '<p>This slot was stamped by <strong>' + esc(result.record.sessionTitle || "a parallel session") + '</strong> at ' + esc(fmtWhen(result.record.at)) + '. Parallel sessions in the same slot count once.</p>' +
        '<a class="app-btn" href="#/stamps">View my stamp card</a>' +
      '</div>';
      return;
    }
    setHint("Stamp collected.");
    box.innerHTML = '<div class="attendance-result is-success">' +
      '<span class="attendance-result-kicker">Stamp collected</span>' +
      '<strong>' + esc(session.title) + '</strong>' +
      '<p>' + esc(session.room) + ' · ' + esc(slot.time) + '</p>' +
      '<div class="attendance-result-progress"><strong>' + p.done + '</strong> of ' + p.total + ' slot stamps' +
        (p.eligible ? ' · souvenir unlocked' : ' · ' + Math.max(0, p.required - p.done) + ' to go') + '</div>' +
      (p.eligible ? '<p class="attendance-claim-inline">Claim code: <strong>' + esc(p.claimCode) + '</strong></p>' : "") +
      '<div class="attendance-result-actions">' +
        '<a class="app-btn" href="#/stamps">View my stamp card</a>' +
        '<button class="app-btn app-btn--ghost" type="button" data-act="startSlotScan">Scan next session</button>' +
      '</div>' +
    '</div>';
  }

  /* Wake lock ------------------------------------------------------------ */
  function requestWakeLock() {
    if (!global.navigator.wakeLock) return;
    try {
      global.navigator.wakeLock.request("screen").then(function (lock) { wakeLock = lock; }).catch(function () {});
    } catch (e) { /* ignore */ }
  }

  function releaseWakeLock() {
    if (wakeLock) {
      try { wakeLock.release(); } catch (e) { /* ignore */ }
      wakeLock = null;
    }
  }

  /* Routing hooks -------------------------------------------------------- */
  function route(hash) {
    var cleanHash = String(hash || "").replace(/^#\/?/, "");
    if (cleanHash === "stamps" || cleanHash === "stamps/" || cleanHash === "attendance" || cleanHash === "attendance/") {
      renderDashboard();
      ctx.show("attendance");
      return true;
    }
    if (cleanHash === "stamps/scan" || cleanHash === "attendance/scan") {
      renderScan();
      ctx.show("attendanceScan");
      requestWakeLock();
      return true;
    }
    return false;
  }

  function onShow(name) {
    if (name !== "attendanceScan") stopScan();
    if (name !== "attendanceScan") releaseWakeLock();
  }

  /* Event delegation ----------------------------------------------------- */
  function handleAction(event) {
    var button = event.target.closest("[data-act]");
    if (!button) return;
    var act = button.getAttribute("data-act");
    if (act === "startSlotScan") startScan();
    else if (act === "stopSlotScan") { stopScan(); setHint("Camera stopped."); }
    else if (act === "toggleStampQr") {
      var panel = doc.getElementById("stampQrPanel");
      if (panel) {
        var opening = panel.hasAttribute("hidden");
        if (opening) panel.removeAttribute("hidden");
        else panel.setAttribute("hidden", "");
        button.setAttribute("aria-expanded", opening ? "true" : "false");
        button.textContent = opening ? "Hide QR code" : "Show QR code";
      }
    }
    else if (act === "manualSlot") {
      var input = doc.getElementById("attendanceCode");
      manualCheckIn(input ? input.value : "");
    }
    else if (act === "resetAttendance") {
      if (!global.confirm("Clear all slot stamps and the souvenir claim code on this device?")) return;
      state.records = {};
      state.claimCode = "";
      storeRemove(KEY);
      renderDashboard();
      ctx.toast("Stamp collection reset");
    }
  }

  function bindUi() {
    [els.attendance, els.scan].forEach(function (container) {
      if (!container) return;
      container.addEventListener("click", handleAction);
    });
  }

  function init(options) {
    if (options) {
      if (options.show) ctx.show = options.show;
      if (options.toast) ctx.toast = options.toast;
      if (options.esc) ctx.esc = options.esc;
    }
    els.attendance = doc.getElementById("attendanceView");
    els.scan = doc.getElementById("attendanceScanView");
    load();
    bindUi();
  }

  global.ASMAttendance = {
    init: init,
    route: route,
    onShow: onShow,
    progress: progress,
    parsePayload: parsePayload,
    resolve: resolve
  };
})(typeof window !== "undefined" ? window : this);
