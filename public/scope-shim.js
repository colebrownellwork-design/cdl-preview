/*
 * Keeps the prototype's page scripts working inside a scoped wrapper.
 *
 * In the prototype, <body> WAS the page, so scripts append backdrops and
 * overlays straight to document.body. Here the page lives inside a
 * `.pg-<slug>` wrapper whose stylesheet is scoped to it, so anything landing on
 * body sits outside that scope: unstyled, and stacked below the content instead
 * of behind it. The homepage's full-height ocean backdrop did exactly that.
 *
 * Rather than edit nine page scripts, this moves stray body children back into
 * the wrapper as they appear. Must run before the page script.
 */
(function () {
  var wrap = document.querySelector('[class^="pg-"]');
  if (!wrap || !window.MutationObserver) return;

  // The page's ground colour came from `body` in the prototype, where it
  // propagates to the canvas and paints before everything. Scoping moved it
  // onto the wrapper, which is an ordinary block: its background then paints
  // *over* the z-index:-1 backdrops, hiding the homepage's ocean animation.
  // Put it back on body and the original paint order is restored.
  var ground = getComputedStyle(wrap).backgroundColor;
  if (ground && ground !== 'rgba(0, 0, 0, 0)' && ground !== 'transparent') {
    document.body.style.background = ground;
    wrap.style.background = 'transparent';
  }

  // Framework plumbing stays where it is. Custom elements (a hyphen in the tag
  // name) are Next's - next-route-announcer, nextjs-portal - never the
  // prototype's, which only ever appends plain divs.
  function isFrameworkNode(el) {
    return /^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(el.tagName) || el.tagName.indexOf('-') !== -1;
  }

  new MutationObserver(function (records) {
    records.forEach(function (record) {
      Array.prototype.forEach.call(record.addedNodes, function (node) {
        if (
          node.nodeType === 1 &&
          node.parentElement === document.body &&
          node !== wrap &&
          !isFrameworkNode(node)
        ) {
          wrap.appendChild(node);
        }
      });
    });
  }).observe(document.body, { childList: true });
})();
