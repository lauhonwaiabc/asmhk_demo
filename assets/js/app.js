/* ASM 2027 event app — prototype (no dependencies) */
(function () {
  "use strict";

  var U = window.ASM_URL || function (p) { return p || ""; };

  var doc = document;
  var store = {
    favs: "asm2027.favs",
    day: "asm2027.day"
  };

  var state = {
    data: null,
    day: "day1",
    type: "all",
    query: "",
    favs: new Set(),
    session: null,
    facultyQuery: "",
    facultyRole: "All",
    submissionTab: "eposters"
  };

  var el = {
    main: doc.getElementById("appMain"),
    views: {
      home: doc.getElementById("view-home"),
      programme: doc.getElementById("view-programme"),
      submission: doc.getElementById("view-submission"),
      sponsors: doc.getElementById("view-sponsors"),
      faculty: doc.getElementById("view-faculty"),
      favourites: doc.getElementById("view-favourites"),
      info: doc.getElementById("view-info"),
      connect: doc.getElementById("view-connect"),
      mycard: doc.getElementById("view-mycard"),
      scan: doc.getElementById("view-scan"),
      attendance: doc.getElementById("view-attendance"),
      attendanceScan: doc.getElementById("view-attendanceScan"),
      cardEdit: doc.getElementById("view-cardEdit"),
      session: doc.getElementById("view-session"),
      person: doc.getElementById("view-person"),
      eposter: doc.getElementById("view-eposter"),
      more: doc.getElementById("view-more")
    },
    list: doc.getElementById("sessionList"),
    favList: doc.getElementById("favList"),
    favEmpty: doc.getElementById("favEmpty"),
    empty: doc.getElementById("emptyState"),
    count: doc.getElementById("count"),
    search: doc.getElementById("search"),
    dayFilter: doc.getElementById("dayFilter"),
    typeFilter: doc.getElementById("typeFilter"),
    nowNext: doc.getElementById("nowNext"),
    detail: doc.getElementById("sessionDetail"),
    back: doc.getElementById("backBtn"),
    personDetail: doc.getElementById("personDetail"),
    personBack: doc.getElementById("personBack"),
    eposterDetail: doc.getElementById("eposterDetail"),
    eposterBack: doc.getElementById("eposterBack"),
    exportFavs: doc.getElementById("exportFavs"),
    clearFavs: doc.getElementById("clearFavs"),
    toast: doc.getElementById("toast"),
    sponsorList: doc.getElementById("sponsorList"),
    eposterList: doc.getElementById("eposterList"),
    eposterSearch: doc.getElementById("eposterSearchApp"),
    eposterCats: doc.getElementById("eposterCats"),
    eposterCount: doc.getElementById("eposterCountApp"),
    eposterEmpty: doc.getElementById("eposterEmptyApp"),
    eposterPrizeInfo: doc.getElementById("eposterPrizeInfo"),
    moreInfo: doc.getElementById("appMoreInfo"),
    homeBar: doc.getElementById("appHomeBar"),
    facultyList: doc.getElementById("facultyList"),
    facultySearch: doc.getElementById("facultySearch"),
    facultyRoles: doc.getElementById("facultyRoles"),
    facultyCount: doc.getElementById("facultyCount"),
    facultyEmpty: doc.getElementById("facultyEmpty"),
    formalProjectAppInfo: doc.getElementById("formalProjectAppInfo"),
    formalProjectAppList: doc.getElementById("formalProjectAppList"),
    submissionTabs: doc.getElementById("submissionTabs")
  };

  var eposterFilter = { q: "", category: "All" };
  var hasInternalHistory = false;

  var NAV_FOR_VIEW = {
    home: "home",
    programme: "programme",
    session: "programme",
    faculty: "faculty",
    person: "faculty",
    favourites: "favourites",
    more: "more",
    info: "more",
    sponsors: "more",
    submission: "submission",
    eposter: "submission",
    connect: "connect",
    mycard: "connect",
    scan: "connect",
    attendance: "stamps",
    attendanceScan: "stamps",
    cardEdit: "connect"
  };

  /* Helpers ------------------------------------------------------------- */
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function infoRow(label, valueHtml) {
    return "<div><dt>" + esc(label) + "</dt><dd>" + valueHtml + "</dd></div>";
  }

  function infoList(rows) {
    return '<dl class="app-info-list">' + rows.join("") + "</dl>";
  }

  function loadFavs() {
    try {
      var raw = window.localStorage.getItem(store.favs);
      if (raw) JSON.parse(raw).forEach(function (id) { state.favs.add(id); });
    } catch (e) { /* ignore */ }
  }

  function saveFavs() {
    try { window.localStorage.setItem(store.favs, JSON.stringify(Array.from(state.favs))); } catch (e) { /* ignore */ }
  }

  function sessionById(id) {
    if (!state.data) return null;
    return state.data.sessions.filter(function (s) { return s.id === id; })[0] || null;
  }

  function dayById(id) {
    if (!state.data) return null;
    return state.data.days.filter(function (d) { return d.id === id; })[0] || null;
  }

  function personById(id) {
    var data = window.ASM_DATA;
    if (!data || !data.people) return null;
    return data.people.filter(function (p) { return p.id === id; })[0] || null;
  }

  function initials(name) {
    var parts = String(name || "")
      .replace(/^(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|Miss)\s+/i, "")
      .split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function avatar(name, extra) {
    return '<span class="avatar' + (extra ? " " + extra : "") + '" aria-hidden="true">' + esc(initials(name)) + "</span>";
  }

  function personLink(id) {
    var p = personById(id);
    if (!p) return "";
    return '<a href="#/person/' + esc(p.id) + '">' + esc(p.name) + "</a>";
  }

  function eposterById(id) {
    var data = window.ASM_DATA;
    if (!data || !data.eposters) return null;
    return data.eposters.filter(function (e) { return e.id === id; })[0] || null;
  }

  function typeLabel(type) {
    return {
      symposium: "Symposium",
      workshop: "Workshop",
      "pre-conference": "Pre-conference workshop",
      session: "Session",
      event: "Ceremony"
    }[type] || "Session";
  }

  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("is-visible");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(function () { el.toast.classList.remove("is-visible"); }, 2400);
  }

  /* Render -------------------------------------------------------------- */
  function card(session) {
    var fav = state.favs.has(session.id);
    var chairs = (session.moderatorIds || []).map(personLink).filter(Boolean).join(", ");
    var chairsHtml = chairs
      ? '<p class="s-chairs"><span>Moderators:</span> ' + chairs + "</p>"
      : "";
    var summary = session.summary
      ? '<p class="s-summary">' + esc(session.summary) + "</p>"
      : "";
    var bookmark = '<svg viewBox="0 0 24 24" fill="' + (fav ? "currentColor" : "none") +
      '" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>';
    return '' +
      '<article class="s-card s-card--' + esc(session.type) + '">' +
        '<span class="s-time">' + esc(session.time || "") + "</span>" +
        '<h2 class="s-title"><a href="#/session/' + esc(session.id) + '">' + esc(session.title) + "</a></h2>" +
        '<p class="s-meta">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>' +
          "<strong>" + esc(session.room) + "</strong></p>" +
        chairsHtml +
        summary +
        '<button class="s-star" type="button" data-fav="' + esc(session.id) + '" aria-pressed="' + (fav ? "true" : "false") +
          '" aria-label="' + (fav ? "Remove from" : "Add to") + ' my programme: ' + esc(session.title) + '">' +
          bookmark + "</button>" +
      "</article>";
  }

  function visibleSessions() {
    if (!state.data) return [];
    var q = state.query.trim().toLowerCase();
    return state.data.sessions.filter(function (s) {
      if (s.day !== state.day) return false;
      if (state.type === "symposium" && s.type !== "symposium" && s.type !== "session") return false;
      if (state.type === "workshop" && s.type !== "workshop" && s.type !== "pre-conference") return false;
      if (state.type !== "all" && state.type !== "symposium" && state.type !== "workshop" && s.type !== state.type) return false;
      if (!q) return true;
      return [s.title, s.room, s.moderators.join(" "), s.time].join(" ").toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderHome() {
    var d = window.ASM_DATA;
    if (!d) return;
    var set = function (id, value) {
      var node = doc.getElementById(id);
      if (node) node.textContent = value;
    };
    set("homeCountSaved", state.favs.size);
    set("homeCountProgramme", (d.sessions || []).length);
    set("homeCountSubmission", (d.eposters || []).length + (d.formalProjectAbstracts || []).length);
    set("homeCountSponsors", (d.sponsors || []).length);
    set("homeCountFaculty", (d.people || []).length);
    if (window.ASMAttendance) {
      var att = window.ASMAttendance.progress();
      set("homeCountAttendance", att ? att.done + "/" + att.total : "0/8");
    }
    if (window.ASMConnect) window.ASMConnect.renderHome();
  }

  function renderProgramme() {
    if (!state.data) return;
    var list = visibleSessions();
    var day = dayById(state.day);
    el.list.innerHTML = list.map(card).join("");
    el.empty.hidden = list.length > 0;
    el.count.textContent = list.length + (list.length === 1 ? " session" : " sessions") +
      (day ? " \u00b7 " + day.long + " \u00b7 " + day.venue : "");
    renderNowNext(list);
  }

  function renderFavourites() {
    if (!state.data) return;
    var dayOrder = {};
    state.data.days.forEach(function (d, i) { dayOrder[d.id] = i; });
    var list = state.data.sessions.filter(function (s) { return state.favs.has(s.id); });
    list.sort(function (a, b) {
      return dayOrder[a.day] - dayOrder[b.day] || String(a.start).localeCompare(String(b.start));
    });
    el.favList.innerHTML = list.map(card).join("");
    el.favEmpty.hidden = list.length > 0;
    el.exportFavs.disabled = list.length === 0;
    el.clearFavs.disabled = list.length === 0;
  }

  function eposterMatches(e) {
    if (eposterFilter.category !== "All" && e.category !== eposterFilter.category) return false;
    var q = eposterFilter.q.toLowerCase();
    if (!q) return true;
    return [e.number, e.title, e.authors, e.presenter, e.affiliation, e.category, (e.keywords || []).join(" ")]
      .join(" ").toLowerCase().indexOf(q) !== -1;
  }

  function eposterCard(e) {
    return '<a class="app-poster" href="#/eposter/' + esc(e.id) + '" data-theme="' + esc(e.theme) + '">' +
      '<span class="app-poster-num">' + esc(e.number) + " &middot; " + esc(e.category) + "</span>" +
      "<strong>" + esc(e.title) + "</strong>" +
      '<span class="app-poster-authors">' + esc(e.authors) + "</span>" +
      (e.pdf ? '<span class="app-poster-badge app-poster-badge--pdf">PDF e-Poster</span>' : "") +
      '<span class="app-poster-cta">Read abstract <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></span>' +
    "</a>";
  }

  function renderEposters() {
    var data = window.ASM_DATA;
    if (!data || !data.eposters) return;
    var info = data.eposterInfo || { categories: [] };
    var eposterToolbar = el.eposterCats ? el.eposterCats.closest(".app-toolbar") : null;
    if (eposterToolbar) eposterToolbar.hidden = data.eposters.length === 0;

    if (el.eposterPrizeInfo) {
      el.eposterPrizeInfo.innerHTML =
        appPresentationSession("epos") +
        appPresentationSession("fpap");
    }

    if (el.eposterCats && !el.eposterCats.children.length) {
      el.eposterCats.innerHTML = ["All"].concat(info.categories || []).map(function (c) {
        return '<button type="button" data-cat="' + esc(c) + '" aria-pressed="' + (c === "All" ? "true" : "false") + '">' + esc(c) + "</button>";
      }).join("");
    }

    var list = data.eposters.filter(eposterMatches);
    el.eposterList.innerHTML = list.map(eposterCard).join("");
    el.eposterEmpty.hidden = list.length > 0;
    el.eposterEmpty.textContent = data.eposters.length ? "No e-Posters match your search." : "e-Posters will be published here once accepted.";
    el.eposterCount.textContent = data.eposters.length ? list.length + (list.length === 1 ? " e-Poster" : " e-Posters") +
      (eposterFilter.category === "All" ? "" : " in " + eposterFilter.category) : "Gallery opens " + data.meta.eProgramme.date;
  }

  function setSubmissionTab(tab) {
    var panes = {
      "eposters": "submissionPane-eposters",
      "formal-project": "submissionPane-formal-project"
    };
    if (!panes[tab]) tab = "eposters";
    state.submissionTab = tab;
    Object.keys(panes).forEach(function (key) {
      var pane = doc.getElementById(panes[key]);
      if (pane) pane.hidden = key !== tab;
    });
    if (el.submissionTabs) {
      Array.prototype.forEach.call(el.submissionTabs.children, function (b) {
        b.setAttribute("aria-pressed", b.getAttribute("data-sub") === tab ? "true" : "false");
      });
    }
  }

  function renderSubmission(tab, keepPosition) {
    tab = tab || "eposters";
    if (tab === "formal-project") renderFormalProjectApp();
    else { tab = "eposters"; renderEposters(); }
    setSubmissionTab(tab);
    if (!keepPosition) show("submission");
  }

  function renderNowNext(list) {
    el.nowNext.hidden = true;
    if (!state.data) return;
    var now = new Date();
    var pad = function (n) { return String(n).padStart(2, "0"); };
    var today = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
    var todays = state.data.sessions.filter(function (s) { return s.date === today; });
    if (!todays.length) return;
    var minutes = now.getHours() * 60 + now.getMinutes();
    var toMin = function (t) {
      if (!t) return null;
      var p = t.split(":");
      return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
    };
    var live = todays.filter(function (s) {
      var a = toMin(s.start), b = toMin(s.end);
      return a != null && b != null && minutes >= a && minutes < b;
    })[0];
    var next = todays.filter(function (s) { return toMin(s.start) > minutes; })[0];
    if (!live && !next) return;
    var s = live || next;
    el.nowNext.innerHTML = "<strong>" + (live ? "Happening now" : "Next") + ": " + esc(s.title) + "</strong>" +
      "<span>" + esc(s.time) + " \u00b7 " + esc(s.room) + "</span>";
    el.nowNext.hidden = false;
  }

  function renderDetail(session) {
    var fav = state.favs.has(session.id);
    var day = dayById(session.day);
    var chairs = (session.moderatorIds || []).map(personLink).filter(Boolean).join(", ") || "\u2014";
    var facs = (session.facilitatorIds || []).map(personLink).filter(Boolean).join(", ");
    var summary = (session.abstract || session.summary) ? '<p class="detail-summary">' + esc(session.abstract || session.summary) + "</p>" : "";
    var related = "";
    if (session.id === "epos") related = '<p class="app-hint"><a href="#/submission">View the accepted e-Posters &rarr;</a></p>';
    if (session.id === "fpap") related = '<p class="app-hint"><a href="#/programme">See the Free Paper session in the programme &rarr;</a></p>';
    var talks = "";
    if (session.talks && session.talks.length) {
      talks = '<div class="detail-talks"><h2>Lectures</h2><ol>' +
        session.talks.map(function (t) {
          var who = t.personId
            ? '<a href="#/person/' + esc(t.personId) + '">' + esc(t.speaker) + "</a>"
            : esc(t.speaker);
          return "<li><strong>" + esc(t.title) + "</strong><span>" + who +
            (t.country ? " (" + esc(t.country) + ")" : "") + "</span>" +
            (t.abstract ? '<p class="talk-abstract">' + esc(t.abstract) + "</p>" : "") + "</li>";
        }).join("") + "</ol></div>";
    } else if (session.points && session.points.length) {
      talks = '<div class="detail-talks"><h3>Workshop outline</h3><ul>' +
        session.points.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul></div>";
    }
    el.detail.innerHTML = '' +
      '<div class="detail-head">' +
        '<span class="detail-type">' + esc(typeLabel(session.type)) + "</span>" +
        '<h1 class="detail-title" id="title-session">' + esc(session.title) + "</h1>" +
      "</div>" +
      summary +
      related +
      '<dl class="detail-list">' +
        '<div><dt>Day</dt><dd>' + esc(day ? day.long : "") + "</dd></div>" +
        '<div><dt>Time</dt><dd>' + esc(session.time || "") + "</dd></div>" +
        '<div><dt>Room</dt><dd>' + esc(session.room) + "</dd></div>" +
        '<div><dt>Moderators</dt><dd>' + chairs + "</dd></div>" +
        (facs ? '<div><dt>Facilitators</dt><dd>' + facs + "</dd></div>" : "") +
      "</dl>" +
      talks +
      '<div class="detail-actions">' +
        '<button class="app-btn" type="button" id="detailStar" aria-pressed="' + (fav ? "true" : "false") + '">' +
          (fav ? "Remove from my programme" : "Add to my programme") + "</button>" +
        '<button class="app-btn app-btn--ghost" type="button" id="detailIcs">Add to calendar</button>' +
        '<button class="app-btn app-btn--ghost" type="button" id="detailShare">Share</button>' +
      "</div>";

    doc.getElementById("detailStar").addEventListener("click", function () { toggleFav(session.id); renderDetail(session); });
    doc.getElementById("detailIcs").addEventListener("click", function () { downloadICS([session]); });
    doc.getElementById("detailShare").addEventListener("click", function () { share(session); });
  }

  /* Routing ------------------------------------------------------------- */
  function setNav(name) {
    doc.querySelectorAll(".app-nav a").forEach(function (a) {
      if (a.getAttribute("data-nav") === name) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function show(name) {
    Object.keys(el.views).forEach(function (key) { el.views[key].hidden = key !== name; });
    if (el.homeBar) el.homeBar.hidden = name === "home";
    setNav(NAV_FOR_VIEW[name] || "");
    if (window.ASMConnect && window.ASMConnect.onShow) window.ASMConnect.onShow(name);
    if (window.ASMAttendance && window.ASMAttendance.onShow) window.ASMAttendance.onShow(name);
    var view = el.views[name];
    if (view) {
      var title = view.querySelector("h1");
      if (title) { title.setAttribute("tabindex", "-1"); title.focus({ preventScroll: true }); }
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function route() {
    var hash = window.location.hash.replace(/^#\/?/, "");
    if (hash.indexOf("connect") === 0 && window.ASMConnect && window.ASMConnect.route(hash)) {
      return;
    }
    if ((hash.indexOf("stamps") === 0 || hash.indexOf("attendance") === 0) && window.ASMAttendance && window.ASMAttendance.route(hash)) {
      return;
    }
    if (hash.indexOf("session/") === 0) {
      var session = sessionById(hash.slice(8));
      if (session) {
        renderDetail(session);
        show("session");
        return;
      }
    }
    if (hash.indexOf("person/") === 0) {
      var person = personById(decodeURIComponent(hash.slice(7)));
      if (person) {
        renderPerson(person);
        show("person");
        return;
      }
      renderFaculty();
      show("faculty");
      return;
    }
    if (hash.indexOf("eposter/") === 0) {
      var poster = eposterById(decodeURIComponent(hash.slice(8)));
      if (poster) {
        renderEposter(poster);
        show("eposter");
        return;
      }
      renderSubmission();
      return;
    }
    if (hash === "more") { show("more"); return; }
    if (hash === "sponsors") { show("sponsors"); return; }
    if (hash === "favourites") { renderFavourites(); show("favourites"); return; }
    if (hash === "home" || hash === "") { renderHome(); show("home"); return; }
    if (hash.indexOf("submission") === 0) {
      var tab = hash.split("/")[1] || "eposters";
      renderSubmission(tab);
      return;
    }
    if (hash === "eposters" || hash === "free-paper") { renderSubmission("eposters"); return; }
    if (hash === "formal-project") { renderSubmission("formal-project"); return; }
    if (hash === "faculty") { renderFaculty(); show("faculty"); return; }
    if (hash === "info") { show("info"); return; }
    if (hash === "programme") { renderProgramme(); show("programme"); return; }
    renderHome();
    show("home");
  }

  /* Actions ------------------------------------------------------------- */
  function toggleFav(id) {
    if (state.favs.has(id)) state.favs.delete(id);
    else state.favs.add(id);
    saveFavs();
    renderProgramme();
    if (!el.views.favourites.hidden) renderFavourites();
    toast(state.favs.has(id) ? "Added to my programme" : "Removed from my programme");
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = doc.createElement("a");
    a.href = url;
    a.download = filename;
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function icsEscape(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  }

  function icsStamp(date, time) {
    return date.replace(/-/g, "") + "T" + (time || "00:00").replace(":", "") + "00";
  }

  function buildICS(sessions) {
    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//ASM 2027//Event app//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VTIMEZONE",
      "TZID:Asia/Hong_Kong",
      "BEGIN:STANDARD",
      "DTSTART:19700101T000000",
      "TZOFFSETFROM:+0800",
      "TZOFFSETTO:+0800",
      "TZNAME:HKT",
      "END:STANDARD",
      "END:VTIMEZONE"
    ];
    sessions.forEach(function (s) {
      if (!s.start || !s.end) return;
      lines.push("BEGIN:VEVENT");
      lines.push("UID:asm2027-" + s.id + "@anaesthesiology.hk");
      lines.push("DTSTAMP:" + icsStamp(new Date().toISOString().slice(0, 10), "00:00") + "Z");
      lines.push("DTSTART;TZID=Asia/Hong_Kong:" + icsStamp(s.date, s.start));
      lines.push("DTEND;TZID=Asia/Hong_Kong:" + icsStamp(s.date, s.end));
      lines.push("SUMMARY:" + icsEscape((window.ASM_DATA && window.ASM_DATA.meta ? window.ASM_DATA.meta.event.shortName : "") + ": " + s.title));
      var description = typeLabel(s.type) + (s.moderators.length ? ". Moderators: " + s.moderators.join(", ") : "");
      lines.push("DESCRIPTION:" + icsEscape(description));
      lines.push("LOCATION:" + icsEscape(s.room + (window.ASM_DATA && window.ASM_DATA.meta ? ", " + window.ASM_DATA.meta.venue.short : "")));
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return lines.join("\r\n") + "\r\n";
  }

  function downloadICS(sessions) {
    var usable = sessions.filter(function (s) { return s.start && s.end; });
    if (!usable.length) { toast("This session has no fixed time yet"); return; }
    download(usable.length === 1 ? "asm2027-session.ics" : "asm2027-my-programme.ics", buildICS(usable));
    toast("Calendar file downloaded");
  }

  function share(session) {
    var url = window.location.origin + window.location.pathname + "#/session/" + session.id;
    if (navigator.share) {
      navigator.share({ title: (window.ASM_DATA && window.ASM_DATA.meta ? window.ASM_DATA.meta.event.shortName : "") + ": " + session.title, text: session.time + " \u00b7 " + session.room, url: url })
        .catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast("Link copied"); }, function () { window.prompt("Copy link", url); });
    } else {
      window.prompt("Copy link", url);
    }
  }

  /* Events -------------------------------------------------------------- */
  function bind() {
    el.dayFilter.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-day]");
      if (!btn) return;
      state.day = btn.getAttribute("data-day");
      try { window.localStorage.setItem(store.day, state.day); } catch (err) { /* ignore */ }
      Array.prototype.forEach.call(el.dayFilter.children, function (b) {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      renderProgramme();
    });

    el.typeFilter.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-type]");
      if (!btn) return;
      state.type = btn.getAttribute("data-type");
      Array.prototype.forEach.call(el.typeFilter.children, function (b) {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      renderProgramme();
    });

    el.search.addEventListener("input", function () {
      state.query = el.search.value;
      renderProgramme();
    });

    if (el.submissionTabs) {
      el.submissionTabs.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-sub]");
        if (!btn) return;
        var tab = btn.getAttribute("data-sub");
        renderSubmission(tab, true);
        history.replaceState(null, "", "#/submission/" + tab);
      });
    }

    if (el.eposterSearch) {
      el.eposterSearch.addEventListener("input", function () {
        eposterFilter.q = el.eposterSearch.value.trim();
        renderEposters();
      });
    }
    if (el.eposterCats) {
      el.eposterCats.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-cat]");
        if (!btn) return;
        eposterFilter.category = btn.getAttribute("data-cat");
        Array.prototype.forEach.call(el.eposterCats.children, function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        renderEposters();
      });
    }

    if (el.facultySearch) {
      el.facultySearch.addEventListener("input", function () {
        state.facultyQuery = el.facultySearch.value.trim();
        renderFaculty();
      });
    }
    if (el.facultyRoles) {
      el.facultyRoles.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-role]");
        if (!btn) return;
        state.facultyRole = btn.getAttribute("data-role");
        Array.prototype.forEach.call(el.facultyRoles.children, function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        renderFaculty();
      });
    }

    [el.list, el.favList].forEach(function (list) {
      list.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-fav]");
        if (!btn) return;
        toggleFav(btn.getAttribute("data-fav"));
      });
    });

    el.exportFavs.addEventListener("click", function () {
      var list = state.data.sessions.filter(function (s) { return state.favs.has(s.id); });
      downloadICS(list);
    });

    el.clearFavs.addEventListener("click", function () {
      if (!window.confirm("Remove all starred sessions?")) return;
      state.favs.clear();
      saveFavs();
      renderFavourites();
      renderProgramme();
      toast("My programme cleared");
    });

    var goBack = function (fallback) {
      if (hasInternalHistory) window.history.back();
      else window.location.hash = fallback;
    };

    el.back.addEventListener("click", function () { goBack("#/programme"); });
    if (el.personBack) el.personBack.addEventListener("click", function () { goBack("#/faculty"); });
    if (el.eposterBack) el.eposterBack.addEventListener("click", function () { goBack("#/submission"); });

    window.addEventListener("hashchange", function () {
      hasInternalHistory = true;
      route();
    });
  }

  function appTable(headers, rows) {
    if (!rows || !rows.length) return '<p class="app-hint">No entries published yet.</p>';
    return '<div class="app-table-wrap"><table class="app-table"><thead><tr>' +
      headers.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") +
      "</tr></thead><tbody>" + rows.map(function (r) {
        return "<tr>" + r.map(function (c, i) {
          return i === r.length - 1 ? '<td class="num">' + esc(c) + "</td>" : "<td>" + esc(c) + "</td>";
        }).join("") + "</tr>";
      }).join("") + "</tbody></table></div>";
  }

  function appList(items) {
    return "<ul>" + (items || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
  }

  function loadInfo() {
    var d = window.ASM_DATA;
    if (!d || !el.moreInfo) return;
    var c = d.contact || {};
    var s = c.secretariat || {};
    var rows = [
      infoRow("General enquiries",
        '<a href="mailto:' + esc(c.generalEmail) + '">' + esc(c.generalEmail) + "</a>"),
      infoRow("Chairperson",
        esc(c.chairName) + '<br><a href="mailto:' + esc(c.chairEmail) + '">' + esc(c.chairEmail) + "</a>")
    ];
    if (s.name) {
      rows.push(infoRow("Meeting Secretariat",
        esc(s.name) + (s.address ? "<br>" + esc(s.address) : "") +
        (s.phone ? "<br>" + esc(s.phone) : "") +
        (s.email ? ' &middot; <a href="mailto:' + esc(s.email) + '">' + esc(s.email) + "</a>" : "")));
    }
    el.moreInfo.innerHTML = infoList(rows);
  }

  function appPresentationSession(id) {
    var d = window.ASM_DATA;
    var s = d.sessions.filter(function (x) { return x.id === id; })[0];
    if (!s) return "";
    var day = d.days.filter(function (x) { return x.id === s.day; })[0];
    var mods = (s.moderatorIds || []).map(personLink).filter(Boolean).join(", ");
    return '<div class="app-card"><h2>' + esc(s.title) + "</h2>" +
      "<p>" + esc(day ? day.long : "") + " &middot; " + esc(s.time) + " &middot; " + esc(s.room) + "</p>" +
      (mods ? "<p><strong>Moderators:</strong> " + mods + "</p>" : "") +
      (s.summary ? "<p>" + esc(s.summary) + "</p>" : "") +
      "</div>";
  }

  function appAbstractCards(list) {
    return (list || []).map(function (a) {
      var paragraphs = String(a.abstract || "").split(/\n\s*\n/).filter(Boolean).map(function (t) {
        return "<p>" + esc(t) + "</p>";
      }).join("");
      return '<details class="app-abstract">' +
        "<summary>" +
          '<span class="app-abstract-num">' + esc(a.number) + "</span>" +
          "<strong>" + esc(a.title) + "</strong>" +
          '<span class="app-abstract-authors">' + esc(a.authors) + "</span>" +
        "</summary>" +
        '<div class="app-abstract-body">' +
          '<p class="app-abstract-aff">' + esc(a.affiliation) + "</p>" +
          paragraphs +
          '<p class="app-abstract-aff"><strong>Presenting author:</strong> ' + esc(a.presenter) + "</p>" +
        "</div></details>";
    }).join("");
  }

  function renderFormalProjectApp() {
    var d = window.ASM_DATA;
    if (!d) return;
    el.formalProjectAppInfo.innerHTML = appPresentationSession("fprj");
    el.formalProjectAppList.innerHTML = d.formalProjectAbstracts.length ? appAbstractCards(d.formalProjectAbstracts) :
      '<p class="app-empty">Accepted abstracts will be published here.</p>';
  }

  function facultyMatches(p) {
    if (state.facultyRole !== "All" && p.role !== state.facultyRole) return false;
    var q = state.facultyQuery.toLowerCase();
    if (!q) return true;
    return [p.name, p.affiliation, p.country, p.role].join(" ").toLowerCase().indexOf(q) !== -1;
  }

  function renderFaculty() {
    var d = window.ASM_DATA;
    if (!d || !el.facultyList) return;

    if (el.facultyRoles && !el.facultyRoles.children.length) {
      ["All", "International faculty", "Local faculty", "Judge"].forEach(function (role) {
        var count = role === "All" ? d.people.length : d.people.filter(function (p) { return p.role === role; }).length;
        var b = doc.createElement("button");
        b.type = "button";
        b.setAttribute("data-role", role);
        b.setAttribute("aria-pressed", role === "All" ? "true" : "false");
        b.textContent = (role === "All" ? "All" : role.replace(" faculty", "")) + " (" + count + ")";
        el.facultyRoles.appendChild(b);
      });
    }

    var list = d.people.filter(facultyMatches);
    var order = ["International faculty", "Local faculty", "Judge", "Organising Committee"];
    var facultyToolbar = el.facultyRoles ? el.facultyRoles.closest(".app-toolbar") : null;
    if (facultyToolbar) facultyToolbar.hidden = d.people.length === 0;

    el.facultyList.innerHTML = order.map(function (role) {
      var group = list.filter(function (p) { return p.role === role; });
      if (!group.length) return "";
      return '<h2 class="app-group-title">' + esc(role) + "</h2>" + group.map(function (p) {
        return '<a class="app-person" href="#/person/' + esc(p.id) + '">' +
          avatar(p.name) +
          '<span class="app-person-main">' +
            "<strong>" + esc(p.name) + "</strong>" +
            "<span>" + esc(p.affiliation) + "</span>" +
            "<small>" + esc(p.country) + (p.country && p.role ? " &middot; " : "") + esc(p.role) + "</small>" +
          "</span>" +
          '<svg class="app-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>' +
        "</a>";
      }).join("");
    }).join("");

    el.facultyEmpty.hidden = list.length > 0;
    el.facultyEmpty.textContent = d.people.length ? "No faculty match your search." : "Faculty will be published here once confirmed.";
    el.facultyCount.textContent = d.people.length ? list.length + (list.length === 1 ? " person" : " people") +
      (state.facultyRole === "All" ? "" : " in " + state.facultyRole) : "To be announced";
  }

  function renderPerson(p) {
    var d = window.ASM_DATA;
    if (!d || !el.personDetail) return;

    var lectureMap = {};
    (d.lectures || []).forEach(function (l) { lectureMap[l.id] = l; });
    var lectures = [];
    (p.lectureIds || []).forEach(function (id) {
      if (lectureMap[id] && lectures.indexOf(lectureMap[id]) === -1) lectures.push(lectureMap[id]);
    });
    (d.lectures || []).forEach(function (l) {
      if (l.speakerId === p.id && lectures.indexOf(l) === -1) lectures.push(l);
    });

    var sessionMap = {};
    (d.sessions || []).forEach(function (s) { sessionMap[s.id] = s; });

    var lectureHtml = lectures.length ? '<h2 class="app-group-title">Lectures</h2>' + lectures.map(function (l) {
      var s = sessionMap[l.sessionId];
      return '<article class="app-lecture">' +
        "<strong>" + esc(l.title) + "</strong>" +
        (s ? '<a class="app-lecture-meta" href="#/session/' + esc(s.id) + '">' + esc(s.title) + " &middot; " + esc(s.time) + " &middot; " + esc(s.room) + "</a>" : "") +
        (l.abstract ? "<p>" + esc(l.abstract) + "</p>" : "") +
      "</article>";
    }).join("") : "";

    var prog = (d.sessions || []).filter(function (s) {
      return (s.moderatorIds || []).indexOf(p.id) !== -1 || (s.facilitatorIds || []).indexOf(p.id) !== -1;
    });
    var progHtml = prog.length ? '<h2 class="app-group-title">In the programme</h2>' + prog.map(function (s) {
      var roles = [];
      if ((s.moderatorIds || []).indexOf(p.id) !== -1) roles.push("Moderator");
      if ((s.facilitatorIds || []).indexOf(p.id) !== -1) roles.push("Facilitator");
      return '<a class="app-session-link" href="#/session/' + esc(s.id) + '">' +
        "<strong>" + esc(s.title) + "</strong>" +
        "<span>" + esc(roles.join(" & ")) + " &middot; " + esc(s.time) + " &middot; " + esc(s.room) + "</span>" +
      "</a>";
    }).join("") : "";

    el.personDetail.innerHTML =
      '<div class="person-hero">' +
        avatar(p.name, "avatar--lg") +
        "<div>" +
          '<span class="detail-type">' + esc(p.role || "Faculty") + "</span>" +
          '<h1 class="detail-title" id="title-person">' + esc(p.name) + "</h1>" +
          (p.affiliation ? '<p class="person-aff">' + esc(p.affiliation) + "</p>" : "") +
          (p.country ? '<p class="person-country">' + esc(p.country) + "</p>" : "") +
        "</div>" +
      "</div>" +
      (p.bio ? '<p class="detail-summary">' + esc(p.bio) + "</p>" : "") +
      lectureHtml +
      progHtml;
  }

  function renderEposter(e) {
    if (!el.eposterDetail) return;
    var meta = [];
    if (e.presenter) meta.push("<div><dt>Presenter</dt><dd>" + esc(e.presenter) + "</dd></div>");
    if (e.affiliation) meta.push("<div><dt>Affiliation</dt><dd>" + esc(e.affiliation) + "</dd></div>");
    if (e.keywords && e.keywords.length) meta.push("<div><dt>Keywords</dt><dd>" + esc(e.keywords.join(", ")) + "</dd></div>");
    if (e.award) meta.push("<div><dt>Award</dt><dd>" + esc(e.award) + "</dd></div>");

    el.eposterDetail.innerHTML =
      '<div class="detail-head">' +
        '<span class="detail-type">' + esc(e.number) + " &middot; " + esc(e.category) + "</span>" +
        '<h1 class="detail-title" id="title-eposter">' + esc(e.title) + "</h1>" +
        '<p class="detail-authors">' + esc(e.authors) + "</p>" +
      "</div>" +
      (e.pdf
        ? '<div class="app-poster-pdf">' +
            '<iframe src="' + esc(U(e.pdf)) + '#view=FitH" title="PDF e-Poster: ' + esc(e.title) + '" loading="lazy"></iframe>' +
            '<a class="app-btn app-btn--ghost" href="' + esc(U(e.pdf)) + '" target="_blank" rel="noopener">Open PDF e-Poster</a>' +
          '</div>'
        : "") +
      (meta.length ? '<dl class="detail-list">' + meta.join("") + "</dl>" : "") +
      '<h2 class="app-group-title">Abstract</h2>' +
      '<p class="detail-summary">' + esc(e.abstract) + "</p>";
  }

  function loadMeta() {
    if (!window.ASM_DATA || !window.ASM_DATA.meta) return;
    var m = window.ASM_DATA.meta;
    var mapUrl = m.venue.mapUrl;
    var dates = doc.getElementById("appDates");
    if (dates) dates.innerHTML = infoList([
      infoRow("Meeting", "<strong>" + esc(m.event.dateLabel) + "</strong>")
    ]);
    var venue = doc.getElementById("appVenue");
    if (venue) venue.innerHTML = infoList([
      infoRow("Address", "<strong>" + esc(m.venue.name) + "</strong><br>" + esc(m.venue.building) + "<br>" + esc(m.venue.street)),
      infoRow("Map", '<a href="' + esc(mapUrl) + '" target="_blank" rel="noopener">Open the map</a>')
    ]);
    var pre = doc.getElementById("appPreConf");
    if (pre) pre.innerHTML = infoList([
      infoRow("Date", esc(m.venue.preConference.label)),
      infoRow("Venue", esc(m.venue.preConference.venue))
    ]);
    var bar = doc.getElementById("appEventDate");
    if (bar) bar.textContent = m.event.dateLabel + " \u00b7 " + m.venue.name;
  }

  function loadSponsors() {
    if (!el.sponsorList || !window.ASM_DATA) return;
    var list = (window.ASM_DATA.sponsors || []).filter(function (s) {
      return s.category !== "Exhibitor";
    });
    if (!list.length) {
      el.sponsorList.innerHTML = '<p class="app-hint">Sponsors will be listed here once confirmed.</p>';
      return;
    }
    el.sponsorList.innerHTML = list.map(function (s) {
      var logo = s.logo
        ? '<img src="' + esc(U(s.logo)) + '" alt="' + esc(s.name) + '" loading="lazy">'
        : '<span class="app-sponsor-wordmark">' + esc(s.name) + "</span>";
      var inner = logo + "<span><strong>" + esc(s.name) + "</strong><small>" + esc(s.category) + "</small></span>";
      if (s.url) {
        return '<a class="app-sponsor" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + inner + "</a>";
      }
      return '<div class="app-sponsor">' + inner + "</div>";
    }).join("");
  }

  function adaptData(d) {
    var people = {};
    d.people.forEach(function (p) { people[p.id] = p; });
    var lectures = {};
    d.lectures.forEach(function (l) { lectures[l.id] = l; });
    return {
      days: d.days,
      sessions: d.sessions.map(function (s) {
        return {
          id: s.id, day: s.day, date: s.date, start: s.start, end: s.end, time: s.time,
          room: s.room, title: s.title, type: s.type, summary: s.summary || "",
          /* Detail views must use the same full description as the website. */
          abstract: s.abstract || "",
          points: s.points || [],
          moderators: (s.moderatorIds || []).map(function (id) { return people[id] ? people[id].name : ""; }).filter(Boolean),
          moderatorIds: s.moderatorIds || [],
          facilitatorIds: (s.facilitatorIds || []).filter(function (id) { return (s.moderatorIds || []).indexOf(id) === -1; }),
          talks: (s.lectureIds || []).map(function (id) {
            var l = lectures[id];
            var p = l ? people[l.speakerId] : null;
            return l ? { title: l.title, speaker: p ? p.name : "", country: p ? p.country : "", personId: p ? p.id : "", abstract: l.abstract || "" } : null;
          }).filter(Boolean)
        };
      })
    };
  }

  function stripLegacyHeaderLinks() {
    Array.prototype.forEach.call(doc.querySelectorAll(".app-site"), function (node) {
      if (node.parentNode) node.parentNode.removeChild(node);
    });
    Array.prototype.forEach.call(doc.querySelectorAll(".app-header a[href]"), function (link) {
      var href = link.getAttribute("href") || "";
      if (/^https?:/i.test(href) || /\.html(?:[?#]|$)/i.test(href)) {
        if (link.parentNode) link.parentNode.removeChild(link);
      }
    });
  }

  function init() {
    stripLegacyHeaderLinks();
    loadFavs();
    var savedDay = null;
    try { savedDay = window.localStorage.getItem(store.day); } catch (e) { /* ignore */ }

    try {
      var data = adaptData(window.ASM_DATA);
      state.data = data;
      if (savedDay && dayById(savedDay)) state.day = savedDay;
      if (data.days && data.days.length) {
        var now = new Date();
        var pad = function (n) { return String(n).padStart(2, "0"); };
        var today = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
        var todaysDay = data.days.filter(function (d) { return d.date === today; })[0];
        if (todaysDay) state.day = todaysDay.id;
        if (!dayById(state.day)) state.day = "day1";
      }
      Array.prototype.forEach.call(el.dayFilter.children, function (b) {
        b.setAttribute("aria-pressed", b.getAttribute("data-day") === state.day ? "true" : "false");
      });
      bind();
      if (window.ASMConnect) window.ASMConnect.init({ show: show, toast: toast, esc: esc });
      if (window.ASMAttendance) window.ASMAttendance.init({ show: show, toast: toast, esc: esc });
      route();
      loadMeta();
      loadInfo();
      loadSponsors();
    } catch (err) {
      el.count.textContent = "The programme could not be loaded.";
      el.list.innerHTML = '<p class="app-empty">The programme is unavailable. Please reload.</p>';
      el.empty.hidden = true;
      if (window.console) console.error(err);
    }
  }

  init();
})();
