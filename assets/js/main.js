/* ASM 2027 — site behaviour (no dependencies) */
(function () {
  "use strict";

  var doc = document;
  var header = doc.getElementById("siteHeader");
  var navToggle = doc.querySelector(".nav-toggle");
  var nav = doc.getElementById("siteNav");
  var dropToggles = doc.querySelectorAll(".nav-drop-toggle");

  /* Mobile navigation ---------------------------------------------------- */
  function closeNav() {
    if (!nav || !navToggle) return;
    nav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    doc.body.classList.remove("nav-open");
  }

  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      doc.body.classList.toggle("nav-open", open);
    });

    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeNav();
    });

    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeNav();
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 1080) closeNav();
    });
  }

  /* Dropdown (click on mobile, hover handled by CSS on desktop) ---------- */
  dropToggles.forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      var li = btn.closest(".has-dropdown");
      var open = li.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  doc.addEventListener("click", function (e) {
    if (!e.target.closest(".has-dropdown")) {
      dropToggles.forEach(function (btn) {
        btn.setAttribute("aria-expanded", "false");
        btn.closest(".has-dropdown").classList.remove("is-open");
      });
    }
  });

  /* Sticky header shadow ------------------------------------------------- */
  var onScroll = function () {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
    var top = doc.getElementById("toTop");
    if (top) top.classList.toggle("is-visible", window.scrollY > 420);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Back to top ---------------------------------------------------------- */
  var toTop = doc.getElementById("toTop");
  if (toTop) {
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* Active navigation ---------------------------------------------------- */
  var here = window.location.pathname.split("/").pop() || "index.html";
  var hereHash = window.location.hash.slice(1);
  doc.querySelectorAll(".site-nav a[href]").forEach(function (a) {
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#" || href.indexOf("http") === 0) return;
    var parts = href.split("#");
    var path = parts[0];
    var hash = parts[1] || "";
    if (path === here && (!hash || hash === hereHash)) {
      a.classList.add("is-active");
      a.setAttribute("aria-current", "page");
      var parent = a.closest(".has-dropdown");
      if (parent) {
        var toggle = parent.querySelector(".nav-drop-toggle");
        if (toggle) toggle.classList.add("is-active");
      }
    }
  });
  if (here === "sponsorship-exhibition.html" || here === "our-sponsors.html") {
    var sponsorshipToggle = doc.querySelector('.nav-drop-toggle[aria-controls="sponsorshipMenu"]');
    if (sponsorshipToggle) sponsorshipToggle.classList.add("is-active");
  }

  /* Countdown ------------------------------------------------------------
     To enable: add data-countdown="YYYY-MM-DDTHH:MM:SS+08:00" to #countdown.
     Leave the attribute empty to show the "dates to be confirmed" state.   */
  var countdown = doc.getElementById("countdown");
  if (countdown) {
    var target = countdown.getAttribute("data-countdown");
    var ts = target ? Date.parse(target) : NaN;
    if (!isNaN(ts) && ts > Date.now()) {
      var fields = {
        days: countdown.querySelector("[data-days]"),
        hours: countdown.querySelector("[data-hours]"),
        minutes: countdown.querySelector("[data-minutes]"),
        seconds: countdown.querySelector("[data-seconds]")
      };
      var tick = function () {
        var diff = ts - Date.now();
        if (diff <= 0) {
          countdown.hidden = true;
          return;
        }
        var d = Math.floor(diff / 86400000);
        var h = Math.floor((diff % 86400000) / 3600000);
        var m = Math.floor((diff % 3600000) / 60000);
        var s = Math.floor((diff % 60000) / 1000);
        if (fields.days) fields.days.textContent = String(d);
        if (fields.hours) fields.hours.textContent = String(h).padStart(2, "0");
        if (fields.minutes) fields.minutes.textContent = String(m).padStart(2, "0");
        if (fields.seconds) fields.seconds.textContent = String(s).padStart(2, "0");
      };
      countdown.hidden = false;
      tick();
      window.setInterval(tick, 1000);
    }
  }

  /* Programme day tabs --------------------------------------------------- */
  var tabLists = doc.querySelectorAll("[data-tabs]");
  tabLists.forEach(function (list) {
    var buttons = list.querySelectorAll('[role="tab"]');
    var panels = doc.querySelectorAll('[role="tabpanel"]');
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) {
          b.setAttribute("aria-selected", "false");
          b.setAttribute("tabindex", "-1");
        });
        btn.setAttribute("aria-selected", "true");
        btn.setAttribute("tabindex", "0");
        panels.forEach(function (p) { p.hidden = p.id !== btn.getAttribute("aria-controls"); });
      });
      btn.addEventListener("keydown", function (e) {
        var i = Array.prototype.indexOf.call(buttons, btn);
        var next = null;
        if (e.key === "ArrowRight") next = buttons[(i + 1) % buttons.length];
        if (e.key === "ArrowLeft") next = buttons[(i - 1 + buttons.length) % buttons.length];
        if (next) { e.preventDefault(); next.focus(); next.click(); }
      });
    });
  });

  /* Programme: day switcher (phones) and jump links ---------------------- */
  var progDays = Array.prototype.slice.call(doc.querySelectorAll(".prog-day"));
  if (progDays.length) {
    var dayIds = progDays.map(function (d) { return d.id; });
    var dayLinks = Array.prototype.slice.call(doc.querySelectorAll(".prog-tab, .prog-toolbar a[href^='#day']"));

    var showDay = function (id, scroll) {
      if (dayIds.indexOf(id) === -1) return;
      progDays.forEach(function (d) { d.classList.toggle("is-active", d.id === id); });
      dayLinks.forEach(function (a) {
        var target = a.getAttribute("data-day") || a.getAttribute("href").slice(1);
        var on = target === id;
        a.classList.toggle("is-active", on);
        if (a.hasAttribute("data-day")) {
          if (on) a.setAttribute("aria-current", "true");
          else a.removeAttribute("aria-current");
        }
      });
      if (scroll) {
        var target = doc.querySelector(".prog-tabs") || doc.getElementById(id);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    var hashDay = window.location.hash.slice(1);
    showDay(dayIds.indexOf(hashDay) !== -1 ? hashDay : "day1", false);

    var initialTarget = doc.getElementById(hashDay);
    if (initialTarget) {
      var parentDay = initialTarget.closest(".prog-day");
      if (parentDay) showDay(parentDay.id, false);
    }

    dayLinks.forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("data-day") || a.getAttribute("href").slice(1);
        if (dayIds.indexOf(id) === -1) return;
        e.preventDefault();
        showDay(id, true);
        if (history.replaceState) history.replaceState(null, "", "#" + id);
      });
    });

    window.addEventListener("hashchange", function () {
      var id = window.location.hash.slice(1);
      if (dayIds.indexOf(id) !== -1) {
        showDay(id, true);
        return;
      }
      var target = doc.getElementById(id);
      var parentDay = target && target.closest(".prog-day");
      if (parentDay) {
        showDay(parentDay.id, false);
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  /* Key dates: mark the next milestone ----------------------------------- */
  var timeline = doc.querySelectorAll(".timeline li[data-date]");
  if (timeline.length) {
    var now = Date.now();
    var marked = false;
    timeline.forEach(function (li) {
      var t = Date.parse(li.getAttribute("data-date") + "T00:00:00+08:00");
      if (isNaN(t)) return;
      if (t < now) {
        li.classList.add("is-past");
      } else if (!marked) {
        li.classList.add("is-next");
        marked = true;
      }
    });
  }

  /* Make wide tables keyboard-scrollable --------------------------------- */
  var wraps = Array.prototype.slice.call(doc.querySelectorAll(".table-wrap"));
  var syncScrollables = function () {
    wraps.forEach(function (w) {
      if (w.scrollWidth > w.clientWidth + 2) {
        if (!w.hasAttribute("tabindex")) w.setAttribute("tabindex", "0");
        if (!w.hasAttribute("role")) w.setAttribute("role", "region");
        if (!w.hasAttribute("aria-label")) {
          var head = w.previousElementSibling;
          var label = "Scrollable table";
          if (head && (head.classList.contains("day-head") || head.tagName === "H2")) {
            label = "Scrollable table: " + head.textContent.trim();
          }
          w.setAttribute("aria-label", label);
        }
      } else {
        w.removeAttribute("tabindex");
      }
    });
  };
  syncScrollables();
  window.addEventListener("resize", syncScrollables);

  /* Reveal on scroll ----------------------------------------------------- */
  var revealEls = doc.querySelectorAll(".reveal");
  if (revealEls.length && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* Print button --------------------------------------------------------- */
  doc.querySelectorAll("[data-print]").forEach(function (btn) {
    btn.addEventListener("click", function () { window.print(); });
  });

  /* Current year --------------------------------------------------------- */
  doc.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
