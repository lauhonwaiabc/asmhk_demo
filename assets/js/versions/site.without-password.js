/* ASM 2027 — new page behaviour
   Progressive enhancement for the content platform: empty states, hotels,
   FAQs, news, CPD tables, search and active navigation.
   No dependencies. */
(function () {
  "use strict";

  var doc = document;
  var S = window.ASM_SITE || {};
  var D = window.ASM_DATA || {};
  var CFG = S.config || {};

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function attr(v) { return esc(v); }
  function qs(sel, root) { return (root || doc).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function isBlank(v) { return v === undefined || v === null || String(v).trim() === ""; }
  function tbc(label) { return '<span class="tbc">' + esc(label || "To be confirmed") + "</span>"; }
  function money(v) {
    if (isBlank(v)) return tbc();
    var s = String(v);
    if (/^(HK\$|By|Free|Included|TBC)/i.test(s)) return esc(s);
    return "HK$" + esc(s);
  }
  function slug(text) {
    return String(text || "").toLowerCase().replace(/&amp;/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  function formatDate(iso) {
    if (!iso) return "";
    var parts = String(iso).split("-");
    if (parts.length !== 3) return esc(iso);
    var d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
    if (isNaN(d.getTime())) return esc(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  }
  function emptyState(title, text, ctaLabel, ctaHref) {
    return '<div class="empty-state"><strong>' + esc(title) + "</strong><p>" + esc(text) + "</p>" +
      (ctaLabel && ctaHref ? '<a class="btn btn-secondary" href="' + attr(ctaHref) + '">' + esc(ctaLabel) + "</a>" : "") +
      "</div>";
  }

  /* ---------------------------------------------------------------- hotels */
  function hotelCard(h) {
    var rates = "";
    if (!isBlank(h.single) || !isBlank(h.double)) {
      rates = '<table class="table01" style="margin:10px 0"><tbody>' +
        '<tr><th style="width:55%">Room</th><th>Per night</th></tr>' +
        '<tr><td>Single</td><td class="num">' + money(h.single) + "</td></tr>" +
        '<tr><td>Double / twin</td><td class="num">' + money(h.double) + "</td></tr>" +
        "</tbody></table>";
    }
    return '<article class="info-card info-card--accent">' +
      "<h3>" + esc(h.name || "Hotel partner") + "</h3>" +
      (h.stars ? '<p class="muted" style="margin:0 0 6px">' + esc(h.stars) + " &middot; " + esc(h.distance || "Distance to be confirmed") + "</p>" : "") +
      (h.address ? "<p>" + esc(h.address) + "</p>" : "") +
      rates +
      "<p><strong>Booking code:</strong> " + (isBlank(h.code) ? tbc() : "<code>" + esc(h.code) + "</code>") + "<br>" +
      "<strong>Cut-off:</strong> " + (isBlank(h.cutoff) ? tbc() : esc(h.cutoff)) + "<br>" +
      "<strong>Cancellation:</strong> " + (isBlank(h.cancellation) ? tbc() : esc(h.cancellation)) + "</p>" +
      (h.family ? "<p><strong>Family:</strong> " + esc(h.family) + "</p>" : "") +
      (h.access ? "<p><strong>Access:</strong> " + esc(h.access) + "</p>" : "") +
      (h.url ? '<p><a class="btn btn-secondary" href="' + attr(h.url) + '" target="_blank" rel="noopener">Hotel website</a></p>' : "") +
      "</article>";
  }

  function renderHotels() {
    var host = qs('[data-render="hotels"]');
    if (!host) return;
    var data = D.accommodation || {};
    var hotels = data.hotels || [];
    if (!hotels.length) {
      host.innerHTML = emptyState(
        data.emptyTitle || "Hotel partners are being confirmed",
        data.bookingNote || "Negotiated rates and booking codes will be published here."
      );
      return;
    }
    host.innerHTML = '<div class="info-grid">' + hotels.map(hotelCard).join("") + "</div>";
  }

  /* ---------------------------------------------------------------- social */
  function socialCard(f) {
    var image = f.image
      ? '<img class="card-photo" src="' + attr(window.ASM_URL ? window.ASM_URL(f.image) : f.image) + '" alt="' + esc(f.imageAlt || f.name) + '" loading="lazy">'
      : "";
    return '<article class="info-card info-card--accent">' +
      image +
      "<h3>" + esc(f.name) + "</h3>" +
      "<p><strong>Date:</strong> " + (isBlank(f.date) ? tbc() : esc(f.date)) + "<br>" +
      "<strong>Time:</strong> " + (isBlank(f.time) ? tbc() : esc(f.time)) + "<br>" +
      "<strong>Venue:</strong> " + (isBlank(f.venue) ? tbc() : esc(f.venue)) + "</p>" +
      (f.note ? "<p>" + esc(f.note) + "</p>" : "") +
      "</article>";
  }

  function renderSocial() {
    var host = qs('[data-render="social"]');
    if (!host) return;
    var list = ((D.meta || {}).social && D.meta.social.functions) || [];
    if (!list.length) {
      host.innerHTML = emptyState("Social programme is being finalised", "Details will be published here when confirmed.");
      return;
    }
    host.innerHTML = '<div class="info-grid">' + list.map(socialCard).join("") + "</div>";
  }

  /* ------------------------------------------------------------------ news */
  function publishedNews() {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    return (D.news || []).filter(function (n) {
      if (!n.date) return true;
      var d = new Date(n.date + "T00:00:00");
      return !isNaN(d.getTime()) && d <= today;
    }).sort(function (a, b) {
      return String(b.date || "").localeCompare(String(a.date || ""));
    });
  }

  function renderNews() {
    var host = qs('[data-render="news"]');
    if (!host) return;
    var list = publishedNews();
    if (!list.length) {
      host.innerHTML = emptyState("No news yet", "Updates will be published here as arrangements are confirmed.");
      return;
    }
    host.innerHTML = '<h2 class="subheader1">Latest updates</h2><div class="news-list">' + list.map(function (n) {
      return '<article class="news-item">' +
        '<p class="date">' + esc(formatDate(n.date)) + (n.tag ? " &middot; " + esc(n.tag) : "") + "</p>" +
        "<h2>" + esc(n.title) + "</h2>" +
        "<p>" + esc(n.summary) + "</p>" +
        (n.url ? '<p><a href="' + attr(n.url) + '">Read more &rarr;</a></p>' : "") +
        "</article>";
    }).join("") + "</div>";
  }

  function renderHomeNews() {
    var host = qs('[data-render="news-home"]');
    if (!host) return;
    var list = publishedNews().slice(0, 3);
    if (!list.length) {
      host.innerHTML = emptyState("Updates coming soon", "News will appear here as arrangements are confirmed.");
      return;
    }
    host.innerHTML = list.map(function (n) {
      return '<article class="news-card">' +
        '<p class="date" style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#5a7480;margin:0">' +
        esc(formatDate(n.date)) + (n.tag ? " &middot; " + esc(n.tag) : "") + "</p>" +
        "<h3>" + esc(n.title) + "</h3>" +
        "<p>" + esc(n.summary) + "</p>" +
        "</article>";
    }).join("");
  }

  function renderCeremony() {
    var host = qs('[data-render="ceremony"]');
    if (!host) return;
    var meta = D.meta || {};
    var c = (meta.ceremony && meta.ceremony.details) || {};
    var dinner = (meta.ceremony && meta.ceremony.dinner) || {};
    function line(v) { return isBlank(v) ? tbc() : esc(v); }
    host.innerHTML = '<div class="info-grid">' +
      '<article class="info-card"><h3>Date and time</h3><p>' + line([c.date, c.time].filter(Boolean).join(", ")) + "</p></article>" +
      '<article class="info-card"><h3>Venue</h3><p>' + line(c.venue) + "</p></article>" +
      '<article class="info-card"><h3>Photo booth</h3><p>' + (isBlank(c.photoBoothArea) ? line(c.photoBooth) : esc(c.photoBoothArea) + " on <strong>" + esc(c.photoBoothFloor) + ", " + esc(meta.venue.name) + "</strong>") + "</p></article>" +
      '<article class="info-card"><h3>Conference / Congregation Dinner</h3><p>' +
        (isBlank(dinner.date) ? tbc() : esc(dinner.date)) + (isBlank(dinner.time) ? "" : ", " + esc(dinner.time)) +
        (isBlank(dinner.venue) ? "" : "<br>" + esc(dinner.venue)) + "</p></article>" +
      "</div>";
  }

  function renderCeremonySchedule() {
    var host = qs('[data-render="ceremony-schedule"]');
    if (!host) return;
    var c = (D.meta && D.meta.ceremony) || {};
    var rows = c.schedule || [];
    if (!rows.length) {
      host.innerHTML = '<p class="muted">The schedule will be published when confirmed.</p>';
      return;
    }
    host.innerHTML = '<div class="table-wrap"><table class="table01" style="max-width:620px">' +
      '<thead><tr><th>Time</th><th>Arrangement</th></tr></thead><tbody>' +
      rows.map(function (row) {
        return "<tr><td>" + esc(row.time) + "</td><td>" + esc(row.item) + "</td></tr>";
      }).join("") +
      "</tbody></table></div>";
  }

  /* ------------------------------------------------------------------- FAQ */
  function initFaqFilter() {
    var input = qs("[data-faq-filter]");
    if (!input) return;
    input.addEventListener("input", function () {
      var q = input.value.toLowerCase().trim();
      qsa(".faq-item").forEach(function (item) {
        item.style.display = !q || item.textContent.toLowerCase().indexOf(q) !== -1 ? "" : "none";
      });
      qsa(".faq-cat").forEach(function (cat) {
        var any = qsa(".faq-item", cat).some(function (i) { return i.style.display !== "none"; });
        cat.style.display = any ? "" : "none";
      });
    });
  }

  /* ------------------------------------------------------------------- CPD */
  function renderCpd() {
    var host = qs('[data-render="cpd-table"]');
    if (!host) return;
    var data = D.cpd || {};
    var rows = data.confirmed || [];
    if (!rows.length) {
      host.innerHTML = emptyState(
        data.emptyTitle || "Confirmed accreditation will be published here",
        data.emptyText || "Only confirmed CME, CPD and CNE points are shown."
      );
      return;
    }
    host.innerHTML = '<div class="table-wrap"><table class="table01"><thead><tr>' +
      "<th>College / association</th><th>Whole meeting</th><th>Day 1</th><th>Day 2</th><th>Category</th>" +
      "</tr></thead><tbody>" + rows.map(function (r) {
        return "<tr><td><strong>" + esc(r.body) + "</strong></td>" +
          '<td class="num">' + esc(r.whole) + "</td>" +
          '<td class="num">' + esc(r.day1) + "</td>" +
          '<td class="num">' + esc(r.day2) + "</td>" +
          '<td class="note">' + esc(r.category) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  /* ------------------------------------------------------------------ types */
  function typeLabel(type) {
    var map = {
      "pre-conference": "Pre-conference", "workshop": "Workshop", "plenary": "Plenary",
      "symposium": "Symposium", "ceremony": "Ceremony", "social": "Social",
      "lecture": "Lecture", "break": "Break", "session": "Session", "nursing": "Nursing",
      "event": "Event"
    };
    return map[type] || (type ? String(type).replace(/-/g, " ") : "Session");
  }

  /* ---------------------------------------------------------------- search */
  var searchBase = [];

  function searchIndex() {
    var node = doc.getElementById("asmSearchIndex");
    if (node) {
      try { searchBase = JSON.parse(node.textContent || "[]"); } catch (e) { searchBase = []; }
    }
    var index = searchBase.slice();
    (D.sessions || []).forEach(function (s) {
      index.push({
        title: s.title,
        url: "programme.html#s-" + s.id,
        kind: "Session",
        keywords: [s.title, s.summary, s.room, typeLabel(s.type)].join(" "),
        summary: [s.time, s.room].filter(Boolean).join(" · ")
      });
    });
    return index;
  }

  function renderSearch() {
    var input = qs("#siteSearchInput");
    var results = qs("#siteSearchResults");
    var meta = qs("#siteSearchMeta");
    if (!input || !results) return;
    var index = searchIndex();

    function paint() {
      var q = input.value.toLowerCase().trim();
      var list = q
        ? index.filter(function (item) {
            return (item.title + " " + item.keywords + " " + item.summary).toLowerCase().indexOf(q) !== -1;
          })
        : searchBase.slice(0, 12);
      meta.textContent = q
        ? list.length + (list.length === 1 ? " result" : " results") + " for “" + input.value.trim() + "”"
        : "Popular pages";
      results.innerHTML = list.slice(0, 30).map(function (item) {
        return '<li class="search-result"><span class="kind">' + esc(item.kind) + "</span>" +
          '<div><a href="' + attr(item.url) + '">' + esc(item.title) + "</a></div>" +
          (item.summary ? "<p>" + esc(item.summary) + "</p>" : "") + "</li>";
      }).join("") || '<li class="search-result"><p>No matches. Try a shorter word or browse the FAQ.</p></li>';
    }
    var params = new URLSearchParams(window.location.search);
    if (params.get("q")) input.value = params.get("q");
    input.addEventListener("input", paint);
    var button = qs("#siteSearchButton");
    if (button) button.addEventListener("click", paint);
    paint();
  }

  /* --------------------------------------------------------------- sponsors */
  function renderPackageCompare() {
    var host = qs('[data-render="package-compare"]');
    if (!host) return;
    var list = D.packages || [];
    if (!list.length) {
      host.innerHTML = "";
      return;
    }
    host.innerHTML = '<h2 class="subheader1">Compare packages</h2><div class="table-wrap"><table class="table01"><thead><tr>' +
      "<th>Package</th><th>What is included</th><th>Investment (HK$)</th><th>Status</th>" +
      "</tr></thead><tbody>" + list.map(function (p) {
        return "<tr><td><strong>" + esc(p.name) + "</strong></td><td>" + esc(p.includes) + "</td>" +
          '<td class="num">' + (isBlank(p.price) ? tbc() : esc(p.price)) + "</td>" +
          '<td class="note">' + (isBlank(p.price) ? "To be confirmed" : "Available") + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      '<p class="muted" style="font-size:12.5px">All amounts in Hong Kong dollars. Availability is confirmed on receipt of a signed contract.</p>';
  }

  /* -------------------------------------------------------------- analytics */
  function initAnalytics() {
    var domain = CFG.plausibleDomain;
    if (!domain || domain === "REPLACE_ME" || window.__asmAnalytics) return;
    window.__asmAnalytics = true;
    var s = doc.createElement("script");
    s.defer = true;
    s.setAttribute("data-domain", domain);
    s.src = "https://plausible.io/js/script.js";
    doc.head.appendChild(s);
  }

  /* ------------------------------------------------------------------- nav */
  var SCROLL_KEY = "asmScrollToContent";

  function initInternalNavScroll() {
    doc.addEventListener("click", function (e) {
      var a = e.target.closest("a[href]");
      if (!a) return;
      if (a.target === "_blank" || a.hasAttribute("download")) return;
      var href = a.getAttribute("href") || "";
      if (!href || href.charAt(0) === "#" || /^(mailto:|tel:|javascript:)/i.test(href)) return;
      var url;
      try { url = new URL(a.href, window.location.href); } catch (err) { return; }
      if (url.origin !== window.location.origin) return;
      if (url.hash) return;
      if (url.pathname === window.location.pathname) return;
      var path = url.pathname.replace(/\/+$/, "");
      if (!path || path === "/index.html" || path.endsWith("/index.html")) return;
      try { window.sessionStorage.setItem(SCROLL_KEY, "1"); } catch (err) { /* ignore */ }
    }, true);
  }

  function scrollBelowBanner() {
    var requested = false;
    try {
      requested = window.sessionStorage.getItem(SCROLL_KEY) === "1";
      window.sessionStorage.removeItem(SCROLL_KEY);
    } catch (err) { return; }
    if (!requested || window.location.hash) return;

    var target = doc.querySelector(".page-intro") || doc.querySelector(".page-body");
    if (!target) return;
    var header = doc.querySelector(".site-header");
    var offset = (header ? header.getBoundingClientRect().height : 0) + 12;
    var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
    var html = doc.documentElement;
    var previous = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    window.scrollTo(0, top);
    html.style.scrollBehavior = previous;
  }

  function scheduleScrollBelowBanner() {
    function run() { window.setTimeout(scrollBelowBanner, 80); }
    window.addEventListener("pageshow", run);
    if (doc.readyState === "complete") run();
  }
  function initNav() {
    var here = window.location.pathname.split("/").pop() || "index.html";
    var map = {
      "committees.html": "aboutMenu", "meeting-information.html": "aboutMenu",
      "travel-visa.html": "aboutMenu", "accommodation.html": "aboutMenu",
      "accessibility.html": "aboutMenu",
      "contact-us.html": "helpMenu",
      "programme.html": "programmeMenu",
      "faculty.html": "programmeMenu", "e-posters.html": "programmeMenu",
      "cpd.html": "programmeMenu", "ondemand.html": "programmeMenu",
      "academic-accreditation.html": "programmeMenu", "formal-project-prize.html": "programmeMenu",
      "call-for-eposter.html": "participateMenu", "call-for-formal-project.html": "participateMenu",
      "call-for-abstracts.html": "participateMenu",
      "registration.html": "participateMenu", "terms.html": "helpMenu",
      "social-functions.html": "engageMenu", "explore-hong-kong.html": "engageMenu",
      "news.html": "engageMenu", "college-ceremony.html": "engageMenu",
      "our-sponsors.html": "sponsorshipMenu", "sponsorship-exhibition.html": "sponsorshipMenu",
      "sponsor-application.html": "sponsorshipMenu",
      "faqs.html": "helpMenu", "search.html": "helpMenu", "privacy.html": "helpMenu",
      "past-asm.html": "helpMenu"
    };
    var target = map[here];
    if (target) {
      var btn = doc.querySelector('.nav-drop-toggle[aria-controls="' + target + '"]');
      if (btn) btn.classList.add("is-active");
    }
    qsa(".site-nav a[href]").forEach(function (a) {
      var href = a.getAttribute("href") || "";
      if (href.split("#")[0] === here) {
        a.classList.add("is-active");
        a.setAttribute("aria-current", "page");
      }
    });
  }

  /* ------------------------------------------------------------------ boot */
  function boot() {
    initAnalytics();
    var page = doc.body.getAttribute("data-page");
    if (page === "home") renderHomeNews();
    if (page === "accommodation") renderHotels();
    if (page === "social") renderSocial();
    if (page === "news") renderNews();
    if (page === "faqs") initFaqFilter();
    if (page === "cpd") renderCpd();
    if (page === "ceremony") { renderCeremony(); renderCeremonySchedule(); }
    if (page === "search") renderSearch();
    if (page === "sponsorship") { renderPackageCompare(); }
    initInternalNavScroll();
    scheduleScrollBelowBanner();
    initNav();
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
