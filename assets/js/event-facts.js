/* Resolve {{event.fact}} tokens in page content from meta.js.
   Runs before first paint, so tokens are not shown to visitors. */
(function () {
  "use strict";

  var meta = window.ASM_DATA_META && window.ASM_DATA_META.meta;
  var contact = (window.ASM_DATA_CONTACT && window.ASM_DATA_CONTACT.contact) || {};
  if (!meta) return;

  var tokens = Object.assign({}, meta, { contact: contact });

  function value(name) {
    return name.split(".").reduce(function (obj, key) {
      return obj && obj[key] !== undefined ? obj[key] : undefined;
    }, tokens);
  }

  function replace(text) {
    return String(text).replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, function (match, name) {
      var v = value(name);
      return v === undefined || v === null ? match : String(v);
    });
  }

  function walkText(root) {
    if (!root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) {
      var node = walker.currentNode;
      if (node.nodeValue && node.nodeValue.indexOf("{{") !== -1) nodes.push(node);
    }
    nodes.forEach(function (node) { node.nodeValue = replace(node.nodeValue); });
  }

  function walkAttributes(root) {
    if (!root) return;
    ["alt", "title", "aria-label", "placeholder", "content", "href", "src"].forEach(function (attr) {
      root.querySelectorAll("[" + attr + "]").forEach(function (el) {
        var v = el.getAttribute(attr);
        if (v && v.indexOf("{{") !== -1) el.setAttribute(attr, replace(v));
      });
    });
  }

  walkText(document.body);
  walkAttributes(document.body);

  if (document.title.indexOf("{{") !== -1) document.title = replace(document.title);
  walkAttributes(document.head);
  walkText(document.head);
})();
