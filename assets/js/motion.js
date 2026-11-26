/* ASM 2027 — motion & interaction layer (no dependencies)
   Adds the entrance choreography, pointer parallax, scroll progress,
   scroll reveals and subtle card interactions. Everything degrades to the
   static page if JavaScript is unavailable or motion is reduced. */
(function () {
  "use strict";

  if (window.__asmMotion) return;
  window.__asmMotion = true;

  var doc = document;
  var root = doc.documentElement;
  var win = window;

  var reduce = false;
  var finePointer = false;
  try {
    reduce = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
    finePointer = win.matchMedia("(hover: hover) and (pointer: fine)").matches;
  } catch (e) {}

  var raf = function (fn) {
    return win.requestAnimationFrame ? win.requestAnimationFrame(fn) : win.setTimeout(fn, 16);
  };

  /* --------------------------------------------------------------------
     Scroll progress bar
     -------------------------------------------------------------------- */
  var progressFill = null;
  var header = doc.getElementById("siteHeader");

  if (header) {
    var progress = doc.createElement("div");
    progress.className = "scroll-progress";
    progress.setAttribute("aria-hidden", "true");
    progress.innerHTML = "<span></span>";
    header.appendChild(progress);
    progressFill = progress.firstChild;
  }

  function updateProgress() {
    if (!progressFill) return;
    var max = root.scrollHeight - root.clientHeight;
    var p = max > 0 ? root.scrollTop / max : 0;
    progressFill.style.transform = "scaleX(" + p.toFixed(4) + ")";
  }
  updateProgress();

  if (reduce) {
    win.addEventListener("scroll", updateProgress, { passive: true });
    return;
  }

  root.classList.add("motion");

  /* --------------------------------------------------------------------
     Hero entrance, pointer light and parallax
     -------------------------------------------------------------------- */
  var banners = [];
  var heroFrame = 0;

  function scheduleHero() {
    if (heroFrame) return;
    heroFrame = raf(function () {
      heroFrame = 0;
      renderHero();
    });
  }

  function renderHero() {
    var vh = win.innerHeight || root.clientHeight;
    for (var i = 0; i < banners.length; i++) {
      var banner = banners[i];
      var state = banner;
      var rect = banner.el.getBoundingClientRect();
      if (rect.bottom < -120 || rect.top > vh + 120) continue;

      var scroll = Math.min(Math.max(-rect.top, 0), rect.height);
      var x = state.mx * 18;
      var y = state.my * 12 + scroll * .08;

      state.layer.style.setProperty("--bg-x", x.toFixed(1) + "px");
      state.layer.style.setProperty("--bg-y", y.toFixed(1) + "px");

      if (state.copy) {
        state.copy.style.transform = "translate3d(" +
          (-state.mx * 6).toFixed(1) + "px," +
          (-state.my * 4).toFixed(1) + "px,0)";
      }
      if (state.theme) {
        state.theme.style.transform = "translate3d(" +
          (state.mx * 14).toFixed(1) + "px," +
          (state.my * 8).toFixed(1) + "px,0)";
      }
    }
  }

  function splitTitle(banner) {
    var title = banner.querySelector(".banner-title");
    if (!title || title.querySelector(".banner-line")) return;
    if (!/<br\s*\/?>/i.test(title.innerHTML)) return;

    var parts = title.innerHTML.split(/<br\s*\/?>/i);
    if (parts.length < 2) return;

    var html = "";
    for (var i = 0; i < parts.length; i++) {
      html += '<span class="banner-line"><span style="--asm-i:' + i + '">' +
        parts[i] + "</span></span>";
    }
    title.innerHTML = html;
  }

  function setupBanner(banner) {
    splitTitle(banner);

    var layer = doc.createElement("div");
    layer.className = "banner-bg";
    layer.setAttribute("aria-hidden", "true");
    banner.insertBefore(layer, banner.firstChild);

    var glow = doc.createElement("div");
    glow.className = "banner-glow";
    glow.setAttribute("aria-hidden", "true");
    banner.appendChild(glow);

    var state = {
      el: banner,
      layer: layer,
      glow: glow,
      copy: banner.querySelector(".banner-copy"),
      theme: banner.querySelector(".banner-theme"),
      mx: 0,
      my: 0
    };

    if (finePointer) {
      banner.addEventListener("pointermove", function (e) {
        var r = banner.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        state.mx = px - .5;
        state.my = py - .5;
        glow.style.setProperty("--gx", (px * 100).toFixed(2) + "%");
        glow.style.setProperty("--gy", (py * 100).toFixed(2) + "%");
        banner.classList.add("has-glow");
        scheduleHero();
      }, { passive: true });

      banner.addEventListener("pointerleave", function () {
        state.mx = 0;
        state.my = 0;
        banner.classList.remove("has-glow");
        scheduleHero();
      });
    }

    banners.push(state);
  }

  var allBanners = doc.querySelectorAll(".banner");
  for (var b = 0; b < allBanners.length; b++) setupBanner(allBanners[b]);

  /* Scroll cue on the home page only. */
  if (allBanners.length && doc.body.getAttribute("data-page") === "home") {
    var cue = doc.createElement("div");
    cue.className = "banner-scroll";
    cue.setAttribute("aria-hidden", "true");
    cue.innerHTML = "<span></span>";
    allBanners[0].appendChild(cue);
  }

  var scrollFrame = 0;
  win.addEventListener("scroll", function () {
    updateProgress();
    if (scrollFrame) return;
    scrollFrame = raf(function () {
      scrollFrame = 0;
      renderHero();
    });
  }, { passive: true });

  win.addEventListener("resize", function () {
    updateProgress();
    scheduleHero();
  });

  scheduleHero();

  /* --------------------------------------------------------------------
     Scroll reveals
     -------------------------------------------------------------------- */
  var revealSelector = [
    ".section-title",
    ".subheader1",
    ".page-intro .lede",
    ".welcome #welcomeContent > p",
    ".signature-row .signature",
    ".theme-quote",
    ".theme-intro",
    ".grid > *",
    ".fact-grid > *",
    ".stream-grid > *",
    ".timeline > li",
    ".notice",
    ".callout",
    ".route-card",
    ".format-card",
    ".eposter-card",
    ".committee-list > p",
    ".fac-card",
    ".table-wrap",
    ".abstract-item",
    ".contact-card",
    ".sponsor-cat",
    ".archive-card",
    ".floorplan-grid > *",
    ".venue-grid > *"
  ].join(", ");

  var candidates = [];
  var seen = [];
  var nodes = doc.querySelectorAll(revealSelector);
  for (var n = 0; n < nodes.length; n++) {
    var node = nodes[n];
    if (node.closest(".banner, .site-header, .site-footer, .detail-modal")) continue;
    if (node.hasAttribute("hidden")) continue;
    if (seen.indexOf(node) !== -1) continue;
    seen.push(node);
    candidates.push(node);
  }

  /* Stagger elements that share a parent (grids, lists). */
  var groups = [];
  candidates.forEach(function (el) {
    var parent = el.parentNode;
    var group = null;
    for (var g = 0; g < groups.length; g++) {
      if (groups[g].parent === parent) { group = groups[g]; break; }
    }
    if (!group) {
      group = { parent: parent, items: [] };
      groups.push(group);
    }
    group.items.push(el);
  });
  groups.forEach(function (group) {
    if (group.items.length < 2) return;
    group.items.forEach(function (el, i) {
      el.style.setProperty("--asm-delay", Math.min(i, 6) * 65 + "ms");
    });
  });

  root.classList.add("has-reveal");

  var viewport = win.innerHeight || root.clientHeight;
  var immediate = [];
  var observer = null;

  candidates.forEach(function (el) {
    var rect = el.getBoundingClientRect();
    if (rect.top < viewport * .94) {
      immediate.push(el);
    } else {
      el.setAttribute("data-asm-reveal", "");
    }
  });

  /* Force the initial hidden state to compute, then reveal above-the-fold
     elements synchronously. This keeps them visible even where rAF is
     throttled (background tabs, headless capture, reduced-power modes). */
  if (immediate.length) {
    void root.offsetWidth;
    immediate.forEach(function (el) { el.classList.add("is-revealed"); });
  }

  if ("IntersectionObserver" in win) {
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      });
    }, { threshold: .08, rootMargin: "0px 0px -7% 0px" });

    candidates.forEach(function (el) {
      if (el.hasAttribute("data-asm-reveal")) observer.observe(el);
    });
  } else {
    candidates.forEach(function (el) { el.classList.add("is-revealed"); });
  }

  /* Keyboard focus should never land on a still-hidden element. */
  doc.addEventListener("focusin", function (e) {
    var target = e.target;
    if (!target || !target.closest) return;
    var hidden = target.closest("[data-asm-reveal]:not(.is-revealed)");
    if (!hidden) return;
    hidden.classList.add("is-revealed");
    if (observer) observer.unobserve(hidden);
  });

  /* --------------------------------------------------------------------
     Theme-card tilt & spotlight
     -------------------------------------------------------------------- */
  if (finePointer) {
    var themeCards = doc.querySelectorAll(".theme-box");
    for (var t = 0; t < themeCards.length; t++) {
      (function (card) {
        var frame = 0;
        var rx = 0;
        var ry = 0;

        card.addEventListener("pointerenter", function () {
          card.classList.add("is-tilting");
        });

        card.addEventListener("pointermove", function (e) {
          var r = card.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width;
          var py = (e.clientY - r.top) / r.height;
          card.style.setProperty("--spot-x", (px * 100).toFixed(1) + "%");
          card.style.setProperty("--spot-y", (py * 100).toFixed(1) + "%");
          rx = (0.5 - py) * 5;
          ry = (px - 0.5) * 7;
          if (frame) return;
          frame = raf(function () {
            frame = 0;
            card.style.transform = "perspective(780px) rotateX(" +
              rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg) translate3d(0,-3px,0)";
          });
        }, { passive: true });

        card.addEventListener("pointerleave", function () {
          card.classList.remove("is-tilting");
          card.style.transform = "";
          card.style.removeProperty("--spot-x");
          card.style.removeProperty("--spot-y");
        });
      })(themeCards[t]);
    }
  }
})();
