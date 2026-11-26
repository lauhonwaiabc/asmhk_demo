/* ASM 2027 data loader
   Edit the files in js/data/ rather than this file.
   Each component assigns one global; this file combines them into window.ASM_DATA. */
(function () {
  "use strict";
  /* Absolute base of the site (works from / and /pages/ alike). */
  window.ASM_BASE = (function () {
    var s = document.currentScript;
    if (!s || !s.src) return "./";
    return new URL("../../", s.src).href;
  })();

  /* Resolve a path stored in js/data (images/..., downloads/...) against the site. */
  window.ASM_URL = function (p) {
    if (!p) return "";
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(p)) return p;
    return window.ASM_BASE + "assets/" + p.replace(/^\.?\//, "");
  };

  window.ASM_DATA = Object.assign(
    {},
    window.ASM_DATA_META || {},
    window.ASM_DATA_COMMITTEE || {},
    window.ASM_DATA_PEOPLE || {},
    window.ASM_DATA_PROGRAMME || {},
    window.ASM_DATA_ABSTRACTS || {},
    window.ASM_DATA_REGISTRATION || {},
    window.ASM_DATA_SPONSORS || {},
    window.ASM_DATA_CONTACT || {},
    window.ASM_DATA_NEWS || {},
    window.ASM_DATA_ACCOMMODATION ? { accommodation: window.ASM_DATA_ACCOMMODATION } : {},
    window.ASM_DATA_CPD ? { cpd: window.ASM_DATA_CPD } : {}
  );

  /* Stamp Collection slots are derived from programme sessions.
     A session belongs to the collection when it has a code. Sessions with
     the same day, start and end form one parallel slot. */
  (function (D) {
    var meta = D.attendance || {};
    var groups = [];
    var byKey = {};
    (D.sessions || []).forEach(function (s) {
      if (!s.code || (s.day !== "day1" && s.day !== "day2")) return;
      var key = s.day + "|" + s.start + "|" + s.end;
      var g = byKey[key];
      if (!g) {
        g = { day: s.day, date: s.date, start: s.start, end: s.end, time: s.time, sessions: [] };
        byKey[key] = g;
        groups.push(g);
      }
      g.sessions.push({ id: s.id, title: s.title, room: s.room, code: s.code });
    });
    groups.sort(function (a, b) {
      return (a.date + a.start).localeCompare(b.date + b.start);
    });
    groups.forEach(function (g, i) {
      var dayNo = g.day === "day1" ? "1" : g.day === "day2" ? "2" : "0";
      g.id = "d" + dayNo + "s" + (i + 1);
      g.label = "Day " + dayNo + " \u00b7 Session " + (i + 1);
    });
    D.attendance = Object.assign({}, meta, { slots: groups, total: groups.length });
    D.attendance.required = Math.min(Number(meta.required) || groups.length, groups.length);
  })(window.ASM_DATA);
})();
