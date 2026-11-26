/* ASM 2027 event app — Connect
   A local-first digital business card: a vCard QR code that any phone
   camera can read, an in-app QR scanner, and a private connections list.
   Everything is stored in this browser; nothing is sent anywhere. */
(function (global) {
  "use strict";

  var doc = document;
  var KEY_CARD = "asm2027.card.v1";
  var KEY_CONNS = "asm2027.connections.v1";
  var MAX_CONNS = 500;
  var ctx = {
    show: function () {},
    toast: function () {},
    esc: function (value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
  };

  var card = null;
  var connections = [];
  var query = "";
  var pending = null;
  var scan = { active: false, stream: null, timer: 0, detector: null, canvas: null, context: null, busy: false };
  var wakeLock = null;
  var els = {};

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /* Small helpers -------------------------------------------------------- */
  function esc(value) { return ctx.esc(value); }

  function uid() {
    return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function clean(value, max) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max || 200);
  }

  function cardName(c) {
    if (!c) return "";
    return clean(c.name || [c.given, c.family].filter(Boolean).join(" "), 80);
  }

  function initials(name) {
    var parts = String(name || "")
      .replace(/^(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|Miss)\s+/i, "")
      .split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function slug(value) {
    var base = String(value == null ? "contact" : value);
    try { base = base.normalize("NFKD"); } catch (e) { /* older browsers */ }
    return base.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase().slice(0, 50) || "contact";
  }

  function safeUrl(value) {
    var url = String(value == null ? "" : value).trim();
    return /^https?:\/\//i.test(url) ? url : "";
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  function meta() {
    return (global.ASM_DATA && global.ASM_DATA.meta) || {};
  }

  function eventLine() {
    var m = meta();
    return m.event.shortName + " \u00b7 " + m.event.city;
  }

  function eventBrand() {
    var m = meta();
    return m.event.shortName + " \u00b7 " + m.event.theme + " \u00b7 " + m.event.city;
  }

  function eventDates() {
    var m = meta();
    return m.event.dateLabel + " \u00b7 " + m.venue.name;
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

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: (mime || "text/plain") + ";charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = doc.createElement("a");
    a.href = url;
    a.download = filename;
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    global.setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
  }

  /* vCard output --------------------------------------------------------- */
  function vEsc(value) {
    return String(value == null ? "" : value)
      .replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\r/g, "")
      .replace(/;/g, "\\;").replace(/,/g, "\\,");
  }

  function utf8Length(ch) {
    var code = ch.codePointAt(0);
    if (code < 0x80) return 1;
    if (code < 0x800) return 2;
    if (code < 0x10000) return 3;
    return 4;
  }

  function fold(line) {
    var out = [];
    var current = "";
    var bytes = 0;
    for (var i = 0; i < line.length;) {
      var code = line.codePointAt(i);
      var ch = String.fromCodePoint(code);
      i += ch.length;
      var size = utf8Length(ch);
      if (bytes + size > 75) {
        out.push(current);
        current = " " + ch;
        bytes = 1 + size;
      } else {
        current += ch;
        bytes += size;
      }
    }
    out.push(current);
    return out;
  }

  function buildVCard(source) {
    var c = source || {};
    var name = cardName(c);
    var parts = name.replace(/^(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|Miss)\s+/i, "").split(/\s+/);
    var family = clean(c.family, 60) || (parts.length > 1 ? parts[parts.length - 1] : "");
    var given = parts.length > 1
      ? name.replace(new RegExp("\\s*" + family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$", "i"), "").trim()
      : name;
    var show = c.show || {};
    var lines = ["BEGIN:VCARD", "VERSION:3.0", "N:" + vEsc(family) + ";" + vEsc(given) + ";;;", "FN:" + vEsc(name)];
    if (c.org) lines.push("ORG:" + vEsc(c.org) + (c.dept ? ";" + vEsc(c.dept) : ""));
    if (c.role) lines.push("TITLE:" + vEsc(c.role));
    if (c.phone && show.phone !== false) lines.push("TEL;TYPE=CELL:" + vEsc(c.phone));
    if (c.email && show.email !== false) lines.push("EMAIL;TYPE=WORK:" + vEsc(c.email));
    if (c.website && show.website !== false) lines.push("URL:" + vEsc(c.website));
    if (c.linkedin && show.website !== false) lines.push("URL:" + vEsc(c.linkedin));
    var note = [];
    if (show.event !== false) note.push(eventLine());
    if (c.note) note.push(clean(c.note, 300));
    if (note.length) lines.push("NOTE:" + vEsc(note.join(" \u2014 ")));
    lines.push("END:VCARD");
    var folded = [];
    lines.forEach(function (line) { folded = folded.concat(fold(line)); });
    return folded.join("\r\n") + "\r\n";
  }

  function vcfFile(source, label) {
    var name = slug(label || cardName(source));
    return new File([buildVCard(source)], name + "-ASM2027.vcf", { type: "text/vcard" });
  }

  /* vCard / QR payload parsing ------------------------------------------- */
  function unescapeV(value) {
    return String(value || "")
      .replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
  }

  function splitEscaped(value, separator) {
    var out = [];
    var cur = "";
    var escaped = false;
    for (var i = 0; i < value.length; i++) {
      var ch = value.charAt(i);
      if (escaped) { cur += ch; escaped = false; continue; }
      if (ch === "\\") { cur += ch; escaped = true; continue; }
      if (ch === separator) { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    out.push(cur);
    return out;
  }

  function parseVCard(text) {
    var cleanText = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "");
    var lines = cleanText.split("\n");
    var fields = { tel: [], email: [], url: [], adr: [] };
    lines.forEach(function (line) {
      var index = line.indexOf(":");
      if (index < 0) return;
      var left = line.slice(0, index).replace(/^item\d+\./i, "");
      var value = line.slice(index + 1);
      var prop = left.split(";")[0].toUpperCase();
      if (prop === "N") {
        var n = splitEscaped(value, ";");
        fields.family = unescapeV(n[0] || "");
        fields.given = unescapeV(n[1] || "");
        fields.prefix = unescapeV(n[3] || "");
      } else if (prop === "FN") fields.name = unescapeV(value);
      else if (prop === "ORG") {
        var org = splitEscaped(value, ";");
        fields.org = unescapeV(org[0] || "");
        fields.dept = unescapeV(org[1] || "");
      } else if (prop === "TITLE" || prop === "ROLE") fields.role = unescapeV(value);
      else if (prop === "TEL") fields.tel.push(unescapeV(value));
      else if (prop === "EMAIL") fields.email.push(unescapeV(value));
      else if (prop === "URL") fields.url.push(unescapeV(value));
      else if (prop === "NOTE") fields.note = unescapeV(value);
      else if (prop === "ADR") fields.adr.push(splitEscaped(value, ";").map(unescapeV).filter(Boolean).join(", "));
      else if (prop === "BDAY") fields.birthday = unescapeV(value);
    });
    var name = fields.name || [fields.prefix, fields.given, fields.family].filter(Boolean).join(" ");
    var result = {
      name: clean(name, 80),
      given: clean(fields.given, 60),
      family: clean(fields.family, 60),
      role: clean(fields.role, 100),
      org: clean(fields.org, 120),
      dept: clean(fields.dept, 100),
      email: clean(fields.email[0], 120),
      phone: clean(fields.tel[0], 60),
      website: "",
      linkedin: "",
      city: clean((fields.adr[0] || "").split(",").slice(-1)[0], 80),
      note: clean(fields.note, 300),
      source: "vCard"
    };
    var allUrls = fields.url.filter(Boolean);
    allUrls.forEach(function (url) {
      if (/linkedin\.com/i.test(url)) result.linkedin = url;
      else if (!result.website) result.website = url;
    });
    return result;
  }

  function parseMeCard(text) {
    var body = String(text).replace(/^MECARD:/i, "").replace(/;;\s*$/, "");
    var out = { source: "MECARD", name: "", given: "", family: "", role: "", org: "", email: "", phone: "", website: "", note: "" };
    body.split(";").forEach(function (entry) {
      var index = entry.indexOf(":");
      if (index < 0) return;
      var key = entry.slice(0, index).toUpperCase();
      var value = entry.slice(index + 1);
      if (key === "N") {
        var n = value.split(",");
        out.family = clean(n[0], 60);
        out.given = clean(n[1], 60);
      } else if (key === "TEL") out.phone = clean(value, 60);
      else if (key === "EMAIL") out.email = clean(value, 120);
      else if (key === "ORG") out.org = clean(value, 120);
      else if (key === "TITLE") out.role = clean(value, 100);
      else if (key === "URL") out.website = clean(value, 200);
      else if (key === "NOTE") out.note = clean(value, 300);
    });
    out.name = clean([out.given, out.family].filter(Boolean).join(" "), 80);
    return out;
  }

  function parsePayload(text) {
    var raw = String(text || "").trim();
    if (raw.length > 20000) raw = raw.slice(0, 20000);
    if (!raw) return null;
    if (/^BEGIN:VCARD/i.test(raw)) return parseVCard(raw);
    if (/^MECARD:/i.test(raw)) return parseMeCard(raw);
    if (/^https?:\/\//i.test(raw)) {
      var url = raw.split(/\s+/)[0];
      return {
        name: "Scanned link", role: "", org: "", email: "", phone: "",
        website: /linkedin\.com/i.test(url) ? "" : url,
        linkedin: /linkedin\.com/i.test(url) ? url : "",
        note: url, source: "Link", linkOnly: true
      };
    }
    if (/^(BEGIN|FN|N|TEL|EMAIL|ORG|TITLE|NOTE)[:;]/im.test(raw) && raw.indexOf(":") > -1) {
      return parseVCard(raw);
    }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return { name: "", email: raw, phone: "", org: "", role: "", website: "", note: "", source: "Email" };
    if (/^\+?[\d\s()-]{7,}$/.test(raw)) return { name: "", email: "", phone: raw, org: "", role: "", website: "", note: "", source: "Phone" };
    return { name: "", role: "", org: "", email: "", phone: "", website: "", linkedin: "", note: raw.slice(0, 300), source: "Text" };
  }

  /* Storage -------------------------------------------------------------- */
  function normaliseCard(input) {
    return {
      name: clean(input.name, 80),
      family: clean(input.family, 60),
      role: clean(input.role, 100),
      org: clean(input.org, 120),
      dept: clean(input.dept, 100),
      email: clean(input.email, 120),
      phone: clean(input.phone, 60),
      website: clean(input.website, 200),
      linkedin: clean(input.linkedin, 200),
      city: clean(input.city, 80),
      note: clean(input.note, 300),
      show: {
        phone: input.show ? input.show.phone !== false : true,
        email: input.show ? input.show.email !== false : true,
        website: input.show ? input.show.website !== false : true,
        event: input.show ? input.show.event !== false : true
      },
      updated: new Date().toISOString()
    };
  }

  function load() {
    try {
      var rawCard = storeGet(KEY_CARD);
      if (rawCard) {
        var parsed = JSON.parse(rawCard);
        if (parsed && typeof parsed === "object") card = parsed;
      }
    } catch (e) { card = null; }
    try {
      var rawConns = storeGet(KEY_CONNS);
      if (rawConns) {
        var parsedConns = JSON.parse(rawConns);
        if (Array.isArray(parsedConns)) connections = parsedConns.filter(function (c) { return c && (c.name || c.email || c.phone); });
      }
    } catch (e) { connections = []; }
  }

  function saveCard(next) {
    card = normaliseCard(next);
    storeSet(KEY_CARD, JSON.stringify(card));
    updateHeaderLink();
  }

  function saveConnections() {
    if (connections.length > MAX_CONNS) connections = connections.slice(0, MAX_CONNS);
    storeSet(KEY_CONNS, JSON.stringify(connections));
  }

  function normaliseConnection(input, source) {
    return {
      id: uid(),
      name: clean(input.name, 80),
      given: clean(input.given, 60),
      family: clean(input.family, 60),
      role: clean(input.role, 100),
      org: clean(input.org, 120),
      dept: clean(input.dept, 100),
      email: clean(input.email, 120),
      phone: clean(input.phone, 60),
      website: clean(input.website, 200),
      linkedin: clean(input.linkedin, 200),
      city: clean(input.city, 80),
      note: clean(input.note, 300),
      source: clean(source || input.source || "QR", 40),
      metAt: new Date().toISOString(),
      metCount: 1
    };
  }

  function findDuplicate(next) {
    var email = next.email.toLowerCase();
    var phone = next.phone.replace(/\D/g, "");
    var name = next.name.toLowerCase().replace(/\s+/g, " ").trim();
    for (var i = 0; i < connections.length; i++) {
      var c = connections[i];
      if (email && c.email && c.email.toLowerCase() === email) return c;
      if (phone && c.phone && c.phone.replace(/\D/g, "") === phone) return c;
      if (!email && !phone && name && c.name && c.name.toLowerCase().replace(/\s+/g, " ").trim() === name) return c;
    }
    return null;
  }

  function saveConnection(input, source) {
    var next = normaliseConnection(input, source);
    if (!next.name) next.name = next.email || next.phone || "Unnamed contact";
    var duplicate = findDuplicate(next);
    if (duplicate) {
      ["role", "org", "dept", "email", "phone", "website", "linkedin", "city"].forEach(function (key) {
        if (next[key] && !duplicate[key]) duplicate[key] = next[key];
      });
      if (next.note && duplicate.note && duplicate.note.indexOf(next.note) === -1) duplicate.note = duplicate.note + " / " + next.note;
      else if (next.note) duplicate.note = next.note;
      duplicate.metAt = next.metAt;
      duplicate.metCount = (duplicate.metCount || 1) + 1;
      saveConnections();
      ctx.toast("Already saved \u2014 updated " + duplicate.name);
      return duplicate;
    }
    connections.unshift(next);
    saveConnections();
    ctx.toast("Saved " + next.name + " to connections");
    return next;
  }

  function removeConnection(id) {
    connections = connections.filter(function (c) { return c.id !== id; });
    saveConnections();
  }

  /* Shared UI fragments -------------------------------------------------- */
  function avatar(name, extra) {
    return '<span class="conn-avatar' + (extra ? " " + extra : "") + '" aria-hidden="true">' + esc(initials(name)) + "</span>";
  }

  function contactLine(c) {
    var bits = [];
    if (c.role) bits.push(c.role);
    if (c.org) bits.push(c.org + (c.dept ? ", " + c.dept : ""));
    return bits.join(" \u00b7 ");
  }

  function payloadSize(text) {
    try { return new Blob([text]).size; } catch (e) { return unescape(encodeURIComponent(String(text))).length; }
  }

  function qrSvg(payload, px, name) {
    try {
      return global.ASMQR.svg(payload, {
        ecc: payloadSize(payload) > 300 ? "L" : "M", border: 4, dark: "#0f3550", light: "#ffffff",
        width: px, height: px, label: "Contact QR code for " + (name || (meta().event.shortName + " delegate"))
      });
    } catch (e) {
      return '<p class="connect-error">The QR code could not be generated. Try removing some optional details.</p>';
    }
  }

  function hasContact(c) {
    return !!(c.name || c.email || c.phone || c.website || c.linkedin);
  }

  /* Connect hub ---------------------------------------------------------- */
  function renderHub() {
    if (!els.hub) return;
    var name = card ? cardName(card) : "";
    var lines = [];

    if (!card) {
      lines.push(
        '<div class="connect-empty">' +
          '<h2>Create your ASM card</h2>' +
          '<a class="app-btn" href="#/connect/edit">Create or import my card</a>' +
        "</div>"
      );
    } else {
      var payload = buildVCard(card);
      lines.push(
        '<div class="mycard">' +
          '<div class="mycard-main">' +
            '<span class="mycard-kicker">' + esc(eventBrand()) + "</span>" +
            "<h2>" + esc(name) + "</h2>" +
            (contactLine(card) ? '<p class="mycard-role">' + esc(contactLine(card)) + "</p>" : "") +
            '<p class="mycard-contact">' +
              (card.email && card.show.email !== false ? esc(card.email) : "") +
              (card.phone && card.show.phone !== false ? (card.email ? " \u00b7 " : "") + esc(card.phone) : "") +
            "</p>" +
            '<p class="mycard-dates">' + esc(eventDates()) + "</p>" +
          "</div>" +
          '<a class="mycard-qr" href="#/connect/qr" aria-label="Enlarge my QR code">' +
            qrSvg(payload, 132, name) +
            '<span>Tap to enlarge</span>' +
          "</a>" +
        "</div>" +
        '<div class="connect-actions">' +
          '<a class="app-btn" href="#/connect/qr">Show my QR</a>' +
          '<a class="app-btn app-btn--ghost" href="#/connect/scan">Scan a contact</a>' +
        "</div>" +
        '<div class="connect-links">' +
          '<button type="button" data-act="saveContact">Save my contact file</button>' +
          '<button type="button" data-act="shareCard">Share my card</button>' +
          '<button type="button" data-act="copyDetails">Copy details</button>' +
          '<a href="#/connect/edit">Edit my card</a>' +
        "</div>"
      );
    }

    lines.push('<div class="connect-head"><h2 class="app-group-title">Connections <span class="connect-count" id="connCount">' + connections.length + "</span></h2>");
    if (connections.length) {
      lines.push(
        '<div class="connect-head-actions">' +
          '<button type="button" data-act="exportAll">Export .vcf</button>' +
          '<button type="button" data-act="exportCsv">CSV</button>' +
        "</div>"
      );
    }
    lines.push("</div>");

    if (connections.length) {
      lines.push('<label class="sr-only" for="connSearch">Search connections</label>');
      lines.push('<input class="app-search connect-search" id="connSearch" type="search" placeholder="Search connections" autocomplete="off" value="' + esc(query) + '">');
    }
    lines.push('<div id="connList"></div>');

    if (connections.length) {
      lines.push('<div class="connect-danger"><button type="button" data-act="clearAll">Delete all connections</button></div>');
    }

    els.hub.innerHTML = lines.join("");
    renderConnections();
    renderHomePanel();
  }

  function filteredConnections() {
    var q = query.trim().toLowerCase();
    if (!q) return connections;
    return connections.filter(function (c) {
      return [c.name, c.role, c.org, c.dept, c.email, c.phone, c.note, c.city]
        .join(" ").toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderConnections() {
    var list = doc.getElementById("connList");
    if (!list) return;
    var count = doc.getElementById("connCount");
    if (count) count.textContent = connections.length;
    var items = filteredConnections();
    if (!connections.length) {
      list.innerHTML = '<p class="app-empty">No connections yet. Scan a QR code, or ask the next person to scan yours.</p>';
      return;
    }
    if (!items.length) {
      list.innerHTML = '<p class="app-empty">No connections match your search.</p>';
      return;
    }
    list.innerHTML = items.map(function (c) {
      var met = c.metCount > 1 ? "Met " + c.metCount + " times" : "Saved " + fmtDate(c.metAt);
      var website = safeUrl(c.website);
      var linkedin = safeUrl(c.linkedin);
      var details = [];
      if (c.email) details.push('<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + "</a>");
      if (c.phone) details.push('<a href="tel:' + esc(c.phone.replace(/[^\d+]/g, "")) + '">' + esc(c.phone) + "</a>");
      if (website) details.push('<a href="' + esc(website) + '" target="_blank" rel="noopener">Website</a>');
      if (linkedin) details.push('<a href="' + esc(linkedin) + '" target="_blank" rel="noopener">LinkedIn</a>');
      return '<article class="conn-card">' +
        avatar(c.name) +
        '<div class="conn-body">' +
          '<div class="conn-top"><strong>' + esc(c.name || "Unnamed contact") + "</strong>" +
            '<span class="conn-met">' + esc(met) + "</span></div>" +
          (contactLine(c) ? '<span class="conn-role">' + esc(contactLine(c)) + "</span>" : "") +
          (details.length ? '<div class="conn-links">' + details.join("") + "</div>" : "") +
          '<details class="conn-details">' +
            "<summary>Details &amp; follow-up</summary>" +
            (c.note ? '<p class="conn-note">' + esc(c.note) + "</p>" : "") +
            '<div class="conn-actions">' +
              (c.email ? '<a class="conn-btn" href="mailto:' + esc(c.email) + "?subject=" + encodeURIComponent("Great meeting you at " + meta().event.shortName) + '">Email</a>' : "") +
              (linkedin ? '<a class="conn-btn" href="' + esc(linkedin) + '" target="_blank" rel="noopener">LinkedIn</a>' : "") +
              '<button class="conn-btn" type="button" data-act="followUp" data-id="' + esc(c.id) + '">Remind me</button>' +
              '<button class="conn-btn" type="button" data-act="saveOne" data-id="' + esc(c.id) + '">Save .vcf</button>' +
              '<button class="conn-btn conn-btn--danger" type="button" data-act="delete" data-id="' + esc(c.id) + '">Delete</button>' +
            "</div>" +
            '<label class="conn-note-label" for="note-' + esc(c.id) + '">Private note</label>' +
            '<textarea class="conn-note-input" id="note-' + esc(c.id) + '" rows="2" maxlength="300" placeholder="Where you met, what to follow up on\u2026">' + esc(c.note || "") + "</textarea>" +
            '<button class="conn-btn" type="button" data-act="saveNote" data-id="' + esc(c.id) + '">Save note</button>' +
          "</details>" +
        "</div>" +
      "</article>";
    }).join("");
  }

  function updateHeaderLink() {
    var link = doc.querySelector(".app-cardlink");
    if (!link) return;
    link.setAttribute("href", card ? "#/connect/qr" : "#/connect/edit");
  }

  function renderHomePanel() {
    var slot = doc.getElementById("homeConnect");
    if (!slot) return;    var count = doc.getElementById("homeCountConnections");
    if (count) count.textContent = connections.length;
    if (!card) {
      slot.innerHTML =
        '<a class="home-connect home-connect--new" href="#/connect">' +
          '<span class="home-connect-icon" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 20h.01M17 21h4"/></svg>' +
          "</span>" +
          '<span class="home-connect-text"><strong>Your ASM card</strong><small>One QR code. Any camera can save your details.</small></span>' +
          '<span class="home-connect-go">Create</span>' +
        "</a>";
      return;
    }
    slot.innerHTML =
      '<div class="home-connect">' +
        '<a class="home-connect-qr" href="#/connect/qr" aria-label="Show my contact QR code">' + qrSvg(buildVCard(card), 64, cardName(card)) + "</a>" +
        '<div class="home-connect-text">' +
          "<strong>" + esc(cardName(card)) + "</strong>" +
          "<small>" + esc(contactLine(card) || eventBrand()) + "</small>" +
          '<span class="home-connect-links"><a href="#/connect/qr">Show QR</a><a href="#/connect/scan">Scan</a><a href="#/connect">' + connections.length + " saved</a></span>" +
        "</div>" +
      "</div>";
  }

  /* Full-screen QR ------------------------------------------------------- */
  function renderQr() {
    if (!els.mycard) return;
    if (!card) {
      els.mycard.innerHTML = '<h1 class="sr-only" id="title-mycard">My QR code</h1><p class="app-empty">Create your card first.</p><p><a class="app-btn" href="#/connect/edit">Create my card</a></p>';
      return;
    }
    var payload = buildVCard(card);
    els.mycard.innerHTML =
      '<h1 class="sr-only" id="title-mycard">My QR code</h1>' +
      '<div class="qr-view">' +
        '<p class="qr-kicker">' + esc(eventBrand()) + "</p>" +
        "<h2>" + esc(cardName(card)) + "</h2>" +
        (contactLine(card) ? '<p class="qr-role">' + esc(contactLine(card)) + "</p>" : "") +
        '<div class="qr-box">' + qrSvg(payload, 320, cardName(card)) + "</div>" +
        '<p class="qr-bright">Turn your screen brightness up for a faster scan.</p>' +
        '<div class="qr-actions">' +
          '<button class="app-btn app-btn--ghost" type="button" data-act="shareCard">Share card</button>' +
          '<button class="app-btn app-btn--ghost" type="button" data-act="saveContact">Save .vcf</button>' +
          '<button class="app-btn app-btn--ghost" type="button" data-act="copyDetails">Copy details</button>' +
        "</div>" +
        '<a class="qr-back" href="#/connect">&larr; Back to Connect</a>' +
      "</div>";
    requestWakeLock();
  }

  /* Scanner -------------------------------------------------------------- */
  function renderScan() {
    if (!els.scan) return;
    stopScan();
    pending = null;
    els.scan.innerHTML =
      '<h1 class="app-title" id="title-scan">Scan a QR code</h1>' +
      '<div class="scan-stage">' +
        '<video class="scan-video" id="scanVideo" playsinline muted aria-label="Camera preview"></video>' +
        '<div class="scan-frame" aria-hidden="true"></div>' +
        '<p class="scan-hint" id="scanHint" role="status">Point the camera at a contact card or a session stamp QR code.</p>' +
      "</div>" +
      '<div class="connect-actions">' +
        '<button class="app-btn" type="button" data-act="startScan">Start camera</button>' +
        '<button class="app-btn app-btn--ghost" type="button" data-act="stopScan" hidden>Stop</button>' +
      "</div>" +
      '<div id="scanResult"></div>';
  }

  function setScanHint(message) {
    var hint = doc.getElementById("scanHint");
    if (hint) hint.textContent = message;
  }

  function startScan() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScanHint("This browser cannot open the camera. Use the paste or .vcf option below.");
      return;
    }
    stopScan();
    setScanHint("Requesting the camera\u2026");
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then(function (stream) {
        scan.stream = stream;
        scan.active = true;
        var video = doc.getElementById("scanVideo");
        if (!video) { stopScan(); return; }
        video.srcObject = stream;
        video.setAttribute("playsinline", "");
        video.muted = true;
        var play = video.play();
        if (play && play.catch) play.catch(function () {});
        scan.canvas = doc.createElement("canvas");
        scan.context = scan.canvas.getContext("2d", { willReadFrequently: true });
        setScanHint("Point the camera at the QR code.");
        var stopButton = doc.querySelector('[data-act="stopScan"]');
        if (stopButton) stopButton.hidden = false;
        setupDetector();
        tick();
      })
      .catch(function (error) {
        var reason = error && error.name === "NotAllowedError" ? "Camera permission was blocked." : "The camera is not available.";
        setScanHint(reason + " Use the paste or .vcf option below.");
      });
  }

  function setupDetector() {
    scan.detector = null;
    try {
      if ("BarcodeDetector" in global) {
        global.BarcodeDetector.getSupportedFormats().then(function (formats) {
          if (formats && formats.indexOf("qr_code") !== -1) {
            scan.detector = new global.BarcodeDetector({ formats: ["qr_code"] });
          }
        }).catch(function () {});
      }
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
    var video = doc.getElementById("scanVideo");
    if (video) { try { video.pause(); } catch (e) {} video.srcObject = null; }
    var stopButton = doc.querySelector('[data-act="stopScan"]');
    if (stopButton) stopButton.hidden = true;
  }

  function tick() {
    if (!scan.active) return;
    var video = doc.getElementById("scanVideo");
    if (video && video.readyState >= 2 && !scan.busy) {
      scan.busy = true;
      detectFrame(video).then(function () { scan.busy = false; }, function () { scan.busy = false; });
    }
    scan.timer = global.setTimeout(tick, 220);
  }

  function detectFrame(video) {
    if (scan.detector) {
      return scan.detector.detect(video).then(function (codes) {
        if (codes && codes.length && codes[0].rawValue) onScanCode(codes[0].rawValue);
      }).catch(function () {
        scan.detector = null;
        return detectWithJsQr(video);
      });
    }
    return Promise.resolve(detectWithJsQr(video));
  }

  function detectWithJsQr(video) {
    if (!global.jsQR || !scan.context) return;
    var width = video.videoWidth;
    var height = video.videoHeight;
    if (!width || !height) return;
    var scale = Math.min(1, 720 / width);
    scan.canvas.width = Math.round(width * scale);
    scan.canvas.height = Math.round(height * scale);
    scan.context.drawImage(video, 0, 0, scan.canvas.width, scan.canvas.height);
    var image = scan.context.getImageData(0, 0, scan.canvas.width, scan.canvas.height);
    var code = global.jsQR(image.data, image.width, image.height);
    if (code && code.data) onScanCode(code.data);
  }

  function onScanCode(raw) {
    stopScan();
    var text = String(raw || "").trim();
    if (/^ASM2027\|STAMPCARD\|/i.test(text)) {
      renderStampCardScan(text);
      return;
    }
    if (/^ASM2027\|(STAMP|ATTEND)\|/i.test(text) &&
        global.ASMAttendance && global.ASMAttendance.resolve) {
      renderSessionScanResult(global.ASMAttendance.resolve(text));
      return;
    }
    previewPayload(text);
  }

  function renderStampCardScan(raw) {
    var target = doc.getElementById("scanResult");
    if (!target) return;
    var parts = raw.split("|");
    var device = parts[2] || "";
    var claim = parts[3] === "-" ? "" : (parts[3] || "");
    var progress = parts[4] || "";
    var list = parts[5] || "";
    var data = global.ASM_DATA || {};
    var sessionMap = {};
    (data.sessions || []).forEach(function (s) { sessionMap[s.id] = s; });
    var slotMap = {};
    ((data.attendance && data.attendance.slots) || []).forEach(function (s) { slotMap[s.id] = s; });
    var rows = list ? list.split(",").map(function (pair) {
      var bits = pair.split(":");
      var slot = slotMap[bits[0]];
      var session = sessionMap[bits[1]];
      return '<li><strong>' + esc(session ? session.title : bits[1]) + '</strong><span>' +
        esc(slot ? slot.label + " · " + slot.time : bits[0]) +
        (session ? " · " + esc(session.room) : "") + "</span></li>";
    }).join("") : "";
    setScanHint("Stamp card scanned.");
    target.innerHTML = '<div class="scan-result">' +
      '<p class="scan-result-kicker">Stamp card verified</p>' +
      '<p><strong>' + esc(progress || "0/8") + ' slot stamps</strong></p>' +
      '<p>Claim code: <strong>' + esc(claim || "Not yet eligible") + '</strong></p>' +
      '<p class="scan-device">Device ID: <code>' + esc(device || "Unknown") + '</code></p>' +
      (rows
        ? '<h2 class="app-group-title">Attended sessions</h2><ul class="scan-card-sessions">' + rows + "</ul>"
        : '<p>No sessions attended yet.</p>') +
      '<div class="connect-actions"><button class="app-btn" type="button" data-act="startScan">Scan another</button></div>' +
    "</div>";
  }

  function renderSessionScanResult(result) {
    var target = doc.getElementById("scanResult");
    if (!target) return;
    if (!result || result.status === "invalid") {
      setScanHint("That session code was not recognised.");
      target.innerHTML = '<div class="scan-result">' +
        '<p class="scan-result-kicker">Not recognised</p>' +
        "<p>" + esc(result && result.message ? result.message : "This is not a valid " + meta().event.shortName + " session code.") + "</p>" +
        '<button class="app-btn" type="button" data-act="startScan">Scan another</button>' +
      "</div>";
      return;
    }
    var slot = result.slot;
    var session = result.session;
    if (result.status === "duplicate") {
      setScanHint("This slot already has a stamp.");
      target.innerHTML = '<div class="scan-result scan-result--saved">' +
        '<p class="scan-result-kicker">Already stamped</p>' +
        "<p><strong>" + esc(slot.label) + "</strong><br>" + esc(session.title) + " &middot; " + esc(session.room) + "</p>" +
        "<p>This slot was stamped by <strong>" + esc(result.record.sessionTitle || "a parallel session") + "</strong>.</p>" +
        '<div class="connect-actions"><a class="app-btn" href="#/stamps">View my stamp card</a>' +
        '<button class="app-btn app-btn--ghost" type="button" data-act="startScan">Scan another</button></div>' +
      "</div>";
      return;
    }
    var p = result.progress;
    setScanHint("Stamp collected.");
    target.innerHTML = '<div class="scan-result scan-result--saved">' +
      '<p class="scan-result-kicker">Stamp collected</p>' +
      "<p><strong>" + esc(session.title) + "</strong><br>" + esc(session.room) + " &middot; " + esc(slot.time) + "</p>" +
      "<p><strong>" + p.done + "</strong> of " + p.total + " slot stamps" +
        (p.eligible ? " &middot; souvenir unlocked" : " &middot; " + Math.max(0, p.required - p.done) + " to go") + "</p>" +
      (p.eligible ? '<p class="attendance-claim-inline">Claim code: <strong>' + esc(p.claimCode) + "</strong></p>" : "") +
      '<div class="connect-actions"><a class="app-btn" href="#/stamps">View my stamp card</a>' +
      '<button class="app-btn app-btn--ghost" type="button" data-act="startScan">Scan another</button></div>' +
    "</div>";
  }

  function previewPayload(raw) {
    var parsed = parsePayload(raw);
    if (!parsed || (!hasContact(parsed) && !parsed.note)) {
      setScanHint("That code is not a contact card.");
      return;
    }
    pending = parsed;
    renderScanResult(parsed);
  }

  function renderScanResult(parsed) {
    var target = doc.getElementById("scanResult");
    if (!target) return;
    var name = parsed.name || "Scanned contact";
    target.innerHTML =
      '<div class="scan-result">' +
        '<p class="scan-result-kicker">Contact found</p>' +
        '<div class="scan-result-head">' + avatar(name) +
          "<div><strong>" + esc(name) + "</strong>" +
          (contactLine(parsed) ? "<span>" + esc(contactLine(parsed)) + "</span>" : "") +
          "</div>" +
        "</div>" +
        '<dl class="scan-fields">' +
          (parsed.email ? "<div><dt>Email</dt><dd>" + esc(parsed.email) + "</dd></div>" : "") +
          (parsed.phone ? "<div><dt>Phone</dt><dd>" + esc(parsed.phone) + "</dd></div>" : "") +
          (parsed.website ? "<div><dt>Website</dt><dd>" + esc(parsed.website) + "</dd></div>" : "") +
          (parsed.linkedin ? "<div><dt>LinkedIn</dt><dd>" + esc(parsed.linkedin) + "</dd></div>" : "") +
          (parsed.note ? "<div><dt>Note</dt><dd>" + esc(parsed.note) + "</dd></div>" : "") +
        "</dl>" +
        '<div class="connect-actions">' +
          '<button class="app-btn" type="button" data-act="saveScan">Save to connections</button>' +
          '<button class="app-btn app-btn--ghost" type="button" data-act="startScan">Scan another</button>' +
        "</div>" +
        (!card ? '<p class="connect-tip"><a href="#/connect/edit">Create your card</a> so you can show yours back.</p>' : '<p class="connect-tip">Saved. <a href="#/connect/qr">Show your card back</a> to complete the exchange.</p>') +
      "</div>";
  }

  /* Card editor ---------------------------------------------------------- */
  function field(id, label, value, type, autocomplete, hint) {
    return '<label class="field"><span>' + esc(label) + "</span>" +
      '<input id="' + id + '" type="' + (type || "text") + '" value="' + esc(value || "") + '"' +
      (autocomplete ? ' autocomplete="' + autocomplete + '"' : "") +
      (type === "email" ? ' inputmode="email"' : type === "tel" ? ' inputmode="tel"' : "") +
      ">" + (hint ? '<small>' + esc(hint) + "</small>" : "") + "</label>";
  }

  function renderEdit() {
    if (!els.edit) return;
    var c = card || {};
    var show = c.show || { phone: true, email: true, website: true, event: true };
    els.edit.innerHTML =
      '<h1 class="app-title" id="title-cardEdit">' + (card ? "Edit my card" : "Create my card") + "</h1>" +
      '<div class="connect-import">' +
        '<div class="connect-import-copy">' +
          "<strong>Start from your phone</strong>" +
        "</div>" +
        '<div class="connect-import-actions">' +
          '<button class="conn-btn" type="button" data-act="importPhone" id="importPhoneBtn" hidden>Import from phone contacts</button>' +
          '<label class="conn-btn conn-btn--file">Choose a .vcf file<input id="importVcf" type="file" accept=".vcf,text/vcard,text/plain"></label>' +
        "</div>" +
      "</div>" +
      '<form id="cardForm" class="card-form" novalidate>' +
        '<div class="form-grid">' +
          field("cName", "Full name *", c.name, "text", "name") +
          field("cFamily", "Family name", c.family, "text", "family-name") +
          field("cRole", "Role / position", c.role, "text", "organization-title") +
          field("cOrg", "Organisation", c.org, "text", "organization") +
          field("cDept", "Department", c.dept, "text", "organization") +
          field("cEmail", "Email", c.email, "email", "email") +
          field("cPhone", "Phone", c.phone, "tel", "tel") +
          field("cWebsite", "Website", c.website, "url", "url") +
          field("cLinkedin", "LinkedIn", c.linkedin, "url", "url", "Paste your full profile URL.") +
          field("cCity", "City", c.city, "text", "address-level2") +
        "</div>" +
        '<label class="field"><span>Note on the card (optional)</span><textarea id="cNote" rows="2" maxlength="300" placeholder="e.g. Airway workshop facilitator">' + esc(c.note || "") + "</textarea></label>" +
        '<fieldset class="checks"><legend>Include in my QR code</legend>' +
          '<label><input type="checkbox" id="sPhone"' + (show.phone !== false ? " checked" : "") + "> Phone</label>" +
          '<label><input type="checkbox" id="sEmail"' + (show.email !== false ? " checked" : "") + "> Email</label>" +
          '<label><input type="checkbox" id="sWebsite"' + (show.website !== false ? " checked" : "") + "> Website / LinkedIn</label>" +
          '<label><input type="checkbox" id="sEvent"' + (show.event !== false ? " checked" : "") + "> Event line</label>" +
        "</fieldset>" +
        '<div class="form-actions">' +
          '<button class="app-btn" type="submit">Save my card</button>' +
          '<a class="app-btn app-btn--ghost" href="#/connect">Cancel</a>' +
        "</div>" +
        (card ? '<div class="connect-danger"><button type="button" data-act="deleteCard">Delete my card</button></div>' : "") +
      "</form>";
    var form = doc.getElementById("cardForm");
    if (form) form.addEventListener("submit", onSaveCard);
    var importer = doc.getElementById("importVcf");
    if (importer) {
      importer.addEventListener("change", function () {
        var file = importer.files && importer.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () { fillCardForm(parsePayload(String(reader.result || ""))); };
        reader.readAsText(file);
      });
    }
    var phoneButton = doc.getElementById("importPhoneBtn");
    if (phoneButton) {
      var supported = !!(navigator.contacts && navigator.contacts.select);
      phoneButton.hidden = !supported;
    }
  }

  function fillCardForm(parsed) {
    if (!parsed) return;
    var map = { cName: "name", cFamily: "family", cRole: "role", cOrg: "org", cDept: "dept", cEmail: "email", cPhone: "phone", cWebsite: "website", cLinkedin: "linkedin", cCity: "city", cNote: "note" };
    Object.keys(map).forEach(function (id) {
      var input = doc.getElementById(id);
      if (input && parsed[map[id]]) input.value = parsed[map[id]];
    });
    ctx.toast("Contact details imported \u2014 review and save");
  }

  function importPhoneContacts() {
    if (!navigator.contacts || !navigator.contacts.select) {
      ctx.toast("This browser cannot open the phone address book \u2014 choose a .vcf file instead.");
      return;
    }
    navigator.contacts.select(["name", "email", "tel"], { multiple: false }).then(function (selected) {
      if (!selected || !selected.length) return;
      var contact = selected[0] || {};
      var name = (contact.name && contact.name[0]) || "";
      var email = (contact.email && contact.email[0]) || "";
      var phone = (contact.tel && contact.tel[0]) || "";
      if (!name && !email && !phone) {
        ctx.toast("That contact has no name, email or phone to import");
        return;
      }
      fillCardForm({ name: name, email: email, phone: phone });
      ctx.toast("Imported from your phone \u2014 add your role and save");
    }).catch(function (error) {
      if (error && error.name === "AbortError") return;
      ctx.toast("Could not open phone contacts \u2014 choose a .vcf file instead.");
    });
  }

  function onSaveCard(event) {
    event.preventDefault();
    var name = clean((doc.getElementById("cName") || {}).value, 80);
    if (!name) {
      ctx.toast("Please enter your name");
      var input = doc.getElementById("cName");
      if (input) input.focus();
      return;
    }
    var email = clean((doc.getElementById("cEmail") || {}).value, 120);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      ctx.toast("Please check the email address");
      return;
    }
    saveCard({
      name: name,
      family: (doc.getElementById("cFamily") || {}).value,
      role: (doc.getElementById("cRole") || {}).value,
      org: (doc.getElementById("cOrg") || {}).value,
      dept: (doc.getElementById("cDept") || {}).value,
      email: email,
      phone: (doc.getElementById("cPhone") || {}).value,
      website: (doc.getElementById("cWebsite") || {}).value,
      linkedin: (doc.getElementById("cLinkedin") || {}).value,
      city: (doc.getElementById("cCity") || {}).value,
      note: (doc.getElementById("cNote") || {}).value,
      show: {
        phone: !!(doc.getElementById("sPhone") || {}).checked,
        email: !!(doc.getElementById("sEmail") || {}).checked,
        website: !!(doc.getElementById("sWebsite") || {}).checked,
        event: !!(doc.getElementById("sEvent") || {}).checked
      }
    });
    ctx.toast("Card saved");
    global.location.hash = "#/connect";
  }

  /* Actions -------------------------------------------------------------- */
  function saveContactFile() {
    if (!card) return;
    var file = vcfFile(card, cardName(card));
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: "My " + meta().event.shortName + " contact card" }).catch(function () { downloadVcf(card); });
    } else {
      downloadVcf(card);
    }
  }

  function downloadVcf(c) {
    download(slug(c.name) + "-ASM2027.vcf", buildVCard(c), "text/vcard");
    ctx.toast("Contact file downloaded");
  }

  function shareCard() {
    if (!card) return;
    shareOrDownload(slug(cardName(card)) + "-ASM2027-card.png", "image/png");
  }

  function copyDetails() {
    if (!card) return;
    var text = [cardName(card), contactLine(card), card.email, card.phone, card.website, card.linkedin, eventLine()]
      .filter(Boolean).join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { ctx.toast("Card details copied"); }, function () { global.prompt("Copy details", text); });
    } else {
      global.prompt("Copy details", text);
    }
  }

  function shareOrDownload(filename, mime) {
    renderCardImage(function (blob) {
      if (!blob) { ctx.toast("The card image could not be created"); return; }
      var file = new File([blob], filename, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: "My " + meta().event.shortName + " card" }).catch(function () {});
      } else {
        var url = URL.createObjectURL(blob);
        var a = doc.createElement("a");
        a.href = url;
        a.download = filename;
        doc.body.appendChild(a);
        a.click();
        doc.body.removeChild(a);
        global.setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
        ctx.toast("Card image downloaded");
      }
    });
  }

  function roundRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + width, y, x + width, y + height, radius);
    context.arcTo(x + width, y + height, x, y + height, radius);
    context.arcTo(x, y + height, x, y, radius);
    context.arcTo(x, y, x + width, y, radius);
    context.closePath();
  }

  function renderCardImage(done) {
    if (!card) { done(null); return; }
    var canvas = doc.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 675;
    var context = canvas.getContext("2d");
    var name = cardName(card);
    var grad = context.createLinearGradient(0, 0, 1200, 675);
    grad.addColorStop(0, "#123f63");
    grad.addColorStop(0.58, "#1f5d7a");
    grad.addColorStop(1, "#2e8f8a");
    context.fillStyle = grad;
    context.fillRect(0, 0, 1200, 675);

    context.globalAlpha = 0.08;
    context.fillStyle = "#ffffff";
    [[1020, 90, 210], [80, 620, 260], [520, -40, 150]].forEach(function (circle) {
      context.beginPath();
      context.arc(circle[0], circle[1], circle[2], 0, Math.PI * 2);
      context.fill();
    });
    context.globalAlpha = 1;

    context.fillStyle = "#ffe3a6";
    context.font = '700 22px "Open Sans", Arial, sans-serif';
    var em = meta().event;
    context.fillText(em.shortName + "  \u00b7  " + em.theme.toUpperCase(), 64, 92);

    context.fillStyle = "#ffffff";
    var nameSize = name.length > 32 ? 52 : name.length > 24 ? 60 : 70;
    context.font = '700 ' + nameSize + 'px "Poppins", "Open Sans", Arial, sans-serif';
    context.fillText(name, 64, 205, 620);

    context.fillStyle = "#d9f0f2";
    context.font = '600 28px "Open Sans", Arial, sans-serif';
    if (card.role) context.fillText(card.role, 64, 255, 600);
    context.font = '400 24px "Open Sans", Arial, sans-serif';
    var org = [card.org, card.dept].filter(Boolean).join(", ");
    if (org) context.fillText(org, 64, 292, 600);

    var contact = [];
    if (card.email && card.show.email !== false) contact.push(card.email);
    if (card.phone && card.show.phone !== false) contact.push(card.phone);
    if (card.website && card.show.website !== false) contact.push(card.website.replace(/^https?:\/\//, ""));
    if (card.linkedin && card.show.website !== false) contact.push(card.linkedin.replace(/^https?:\/\//, ""));
    context.fillStyle = "#e8f7f7";
    context.font = '400 23px "Open Sans", Arial, sans-serif';
    contact.slice(0, 4).forEach(function (line, index) { context.fillText(line, 64, 355 + index * 34, 600); });

    context.fillStyle = "#cbe7ee";
    context.font = '400 20px "Open Sans", Arial, sans-serif';
    context.fillText(eventDates(), 64, 560, 620);
    context.fillText("Scan the code to save my contact details.", 64, 598, 620);

    context.fillStyle = "rgba(255,255,255,0.96)";
    roundRect(context, 720, 110, 416, 455, 26);
    context.fill();
    context.fillStyle = "#0f3550";
    context.font = '700 24px "Poppins", "Open Sans", Arial, sans-serif';
    context.fillText("Let's connect", 756, 162);
    context.fillStyle = "#53707c";
    context.font = '400 18px "Open Sans", Arial, sans-serif';
    context.fillText("Scan with any phone camera", 756, 192);

    var qrCanvas = doc.createElement("canvas");
    try {
      global.ASMQR.draw(qrCanvas, buildVCard(card), { pixelSize: 720, border: 4, dark: "#0f3550", light: "#ffffff", ecc: payloadSize(buildVCard(card)) > 300 ? "L" : "M" });
      context.imageSmoothingEnabled = false;
      context.drawImage(qrCanvas, 756, 212, 344, 344);
    } catch (e) { /* leave the panel blank */ }

    context.fillStyle = "#123f63";
    context.font = '700 26px "Poppins", "Open Sans", Arial, sans-serif';
    context.fillText(meta().event.shortName + " \u00b7 " + meta().event.city, 64, 640);

    var logo = new Image();
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      try {
        canvas.toBlob(function (blob) { done(blob); }, "image/png");
      } catch (e) { done(null); }
    }
    logo.onload = function () {
      try { context.drawImage(logo, 1080, 48, 64, 64); } catch (e) {}
      finish();
    };
    logo.onerror = finish;
    logo.src = (window.ASM_URL ? window.ASM_URL("images/asm2027-logo.png") : "images/asm2027-logo.png") + "?v=20261121d";
    global.setTimeout(finish, 1200);
  }

  /* Export --------------------------------------------------------------- */
  function exportAll() {
    var text = connections.map(function (c) { return buildVCard(c); }).join("");
    download("ASM2027-connections.vcf", text, "text/vcard");
    ctx.toast(connections.length + " connections exported");
  }

  function exportCsv() {
    function cell(value) { return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"'; }
    var rows = [["Name", "Role", "Organisation", "Email", "Phone", "Website", "LinkedIn", "Saved", "Note"].map(cell).join(",")];
    connections.forEach(function (c) {
      rows.push([c.name, c.role, c.org, c.email, c.phone, c.website, c.linkedin, c.metAt, c.note].map(cell).join(","));
    });
    download("ASM2027-connections.csv", rows.join("\r\n") + "\r\n", "text/csv");
    ctx.toast("CSV downloaded");
  }

  function followUp(c) {
    if (!c) return;
    var m = meta();
    var end = m.event.end;
    if (!end) return;
    var date = new Date(end + "T09:00:00");
    date.setDate(date.getDate() + 7);
    var pad = function (n) { return String(n).padStart(2, "0"); };
    var day = date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
    var stamp = day.replace(/-/g, "") + "T090000";
    var endStamp = day.replace(/-/g, "") + "T091500";
    var description = [contactLine(c), c.email, c.phone, c.note].filter(Boolean).join("\\n");
    var lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ASM 2027//Connect//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VTIMEZONE", "TZID:Asia/Hong_Kong", "BEGIN:STANDARD", "DTSTART:19700101T000000",
      "TZOFFSETFROM:+0800", "TZOFFSETTO:+0800", "TZNAME:HKT", "END:STANDARD", "END:VTIMEZONE",
      "BEGIN:VEVENT",
      "UID:asm2027-connect-" + c.id + "@anaesthesiology.hk",
      "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "") + "Z",
      "DTSTART;TZID=Asia/Hong_Kong:" + stamp,
      "DTEND;TZID=Asia/Hong_Kong:" + endStamp,
      "SUMMARY:" + "Follow up with " + c.name.replace(/[,;]/g, " "),
      "DESCRIPTION:" + description.replace(/[,;]/g, " ").replace(/\n/g, "\\n"),
      "END:VEVENT", "END:VCALENDAR"
    ];
    download(slug(c.name) + "-follow-up.ics", lines.join("\r\n") + "\r\n", "text/calendar");
    ctx.toast("Follow-up reminder downloaded");
  }

  /* Screen wake lock ----------------------------------------------------- */
  function requestWakeLock() {
    try {
      if ("wakeLock" in navigator && navigator.wakeLock) {
        navigator.wakeLock.request("screen").then(function (lock) { wakeLock = lock; }).catch(function () {});
      }
    } catch (e) { /* ignore */ }
  }

  function releaseWakeLock() {
    if (wakeLock) {
      try { wakeLock.release(); } catch (e) {}
      wakeLock = null;
    }
  }

  /* Routing hooks -------------------------------------------------------- */
  function route(hash) {
    var cleanHash = String(hash || "").replace(/^#\/?/, "");
    if (cleanHash === "connect" || cleanHash === "connect/") {
      renderHub();
      ctx.show("connect");
      return true;
    }
    if (cleanHash === "connect/qr") {
      renderQr();
      ctx.show("mycard");
      return true;
    }
    if (cleanHash === "connect/scan") {
      renderScan();
      ctx.show("scan");
      return true;
    }
    if (cleanHash === "connect/edit") {
      renderEdit();
      ctx.show("cardEdit");
      return true;
    }
    return false;
  }

  function onHash() {
    var hash = global.location.hash.replace(/^#\/?/, "");
    var isConnect = hash.indexOf("connect") === 0;
    if (!isConnect) {
      stopScan();
      releaseWakeLock();
    }
    if (isConnect && hash !== "connect/scan") stopScan();
    if (isConnect && hash !== "connect/qr") releaseWakeLock();
    var header = doc.querySelector(".app-cardlink");
    var scanLink = doc.querySelector(".app-scanlink");
    var onScan = hash === "connect/scan";
    if (header) {
      if (isConnect && !onScan) header.setAttribute("aria-current", "page");
      else header.removeAttribute("aria-current");
    }
    if (scanLink) {
      if (onScan) scanLink.setAttribute("aria-current", "page");
      else scanLink.removeAttribute("aria-current");
    }
  }

  function onShow(name) {
    if (name !== "scan") stopScan();
    if (name !== "mycard") releaseWakeLock();
  }

  /* Event delegation ----------------------------------------------------- */
  function handleAction(event) {
    var button = event.target.closest("[data-act]");
    if (!button) return;
    var act = button.getAttribute("data-act");
    var id = button.getAttribute("data-id");
    var conn = id ? connections.filter(function (c) { return c.id === id; })[0] : null;

    if (act === "saveContact") saveContactFile();
    else if (act === "shareCard") shareCard();
    else if (act === "copyDetails") copyDetails();
    else if (act === "importPhone") importPhoneContacts();
    else if (act === "startScan") startScan();
    else if (act === "stopScan") { stopScan(); setScanHint("Camera stopped."); }
    else if (act === "saveScan" && pending) {
      var saved = saveConnection(pending, pending.source || "QR");
      renderHub();
      var result = doc.getElementById("scanResult");
      if (result) {
        result.innerHTML = '<div class="scan-result scan-result--saved">' +
          '<p class="scan-result-kicker">Saved</p>' +
          "<p><strong>" + esc(saved.name) + "</strong> is now in your connections.</p>" +
          '<div class="connect-actions"><a class="app-btn" href="#/connect/qr">Show my card back</a>' +
          '<a class="app-btn app-btn--ghost" href="#/connect">View connections</a></div></div>';
      }
      pending = null;
    }
    else if (act === "saveNote" && conn) {
      var noteInput = doc.getElementById("note-" + id);
      conn.note = clean(noteInput ? noteInput.value : "", 300);
      saveConnections();
      renderConnections();
      ctx.toast("Note saved");
    }
    else if (act === "delete" && conn) {
      if (!global.confirm("Delete " + conn.name + " from your connections?")) return;
      removeConnection(id);
      renderHub();
      ctx.toast("Connection deleted");
    }
    else if (act === "saveOne" && conn) downloadVcf(conn);
    else if (act === "followUp" && conn) followUp(conn);
    else if (act === "exportAll") exportAll();
    else if (act === "exportCsv") exportCsv();
    else if (act === "clearAll") {
      if (!global.confirm("Delete all saved connections? This cannot be undone.")) return;
      connections = [];
      saveConnections();
      renderHub();
      ctx.toast("All connections deleted");
    }
    else if (act === "deleteCard") {
      if (!global.confirm("Delete your card? Your saved connections will stay.")) return;
      card = null;
      storeRemove(KEY_CARD);
      updateHeaderLink();
      renderHomePanel();
      ctx.toast("Card deleted");
      global.location.hash = "#/connect";
    }
  }

  function bindUi() {
    [els.hub, els.mycard, els.scan, els.edit].forEach(function (container) {
      if (!container) return;
      container.addEventListener("click", handleAction);
    });
    if (els.hub) {
      els.hub.addEventListener("input", function (event) {
        if (event.target && event.target.id === "connSearch") {
          query = event.target.value;
          renderConnections();
        }
      });
    }
  }

  /* Init ----------------------------------------------------------------- */
  function init(options) {
    if (options) {
      if (options.show) ctx.show = options.show;
      if (options.toast) ctx.toast = options.toast;
      if (options.esc) ctx.esc = options.esc;
    }
    els.hub = doc.getElementById("connectHub");
    els.mycard = doc.getElementById("myCardView");
    els.scan = doc.getElementById("scanView");
    els.edit = doc.getElementById("cardEditView");
    load();
    bindUi();
    updateHeaderLink();
    renderHomePanel();
    global.addEventListener("hashchange", onHash);
    onHash();
  }

  global.ASMConnect = {
    init: init,
    route: route,
    onShow: onShow,
    renderHome: renderHomePanel,
    buildVCard: buildVCard,
    parsePayload: parsePayload,
    count: function () { return connections.length; }
  };
})(typeof window !== "undefined" ? window : this);
