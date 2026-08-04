/**
 * Keep tooltip bubbles inside the viewport (mobile-safe).
 * Used by glossary hints and optional callers (e.g. poi quest).
 */
(function (global) {
  "use strict";

  var MARGIN = 8;

  function place(anchor, tip) {
    if (!anchor || !tip) return;
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var maxW = Math.min(18 * 16, vw - MARGIN * 2);

    tip.classList.remove("tip-below");
    tip.style.display = "block";
    tip.style.position = "fixed";
    tip.style.left = "0";
    tip.style.top = "0";
    tip.style.right = "auto";
    tip.style.bottom = "auto";
    tip.style.transform = "none";
    tip.style.maxWidth = maxW + "px";
    tip.classList.add("is-placed");

    var anchorRect = anchor.getBoundingClientRect();
    var tipRect = tip.getBoundingClientRect();
    var width = Math.min(tipRect.width || maxW, maxW);
    var height = tipRect.height || tip.offsetHeight || 0;

    var top = anchorRect.top - height - MARGIN;
    var below = false;
    if (top < MARGIN) {
      top = anchorRect.bottom + MARGIN;
      below = true;
    }
    if (top + height > vh - MARGIN) {
      top = Math.max(MARGIN, Math.min(top, vh - MARGIN - height));
    }

    var left = anchorRect.left + anchorRect.width / 2 - width / 2;
    left = Math.min(Math.max(MARGIN, left), Math.max(MARGIN, vw - MARGIN - width));

    tip.style.left = left + "px";
    tip.style.top = top + "px";
    tip.classList.toggle("tip-below", below);

    var arrow = anchorRect.left + anchorRect.width / 2 - left;
    arrow = Math.min(Math.max(12, arrow), Math.max(12, width - 12));
    tip.style.setProperty("--tip-arrow-left", arrow + "px");
  }

  function clear(tip) {
    if (!tip) return;
    tip.style.display = "";
    tip.style.position = "";
    tip.style.left = "";
    tip.style.right = "";
    tip.style.top = "";
    tip.style.bottom = "";
    tip.style.transform = "";
    tip.style.maxWidth = "";
    tip.style.removeProperty("--tip-arrow-left");
    tip.classList.remove("tip-below", "is-placed");
  }

  function clearAll(selector) {
    document.querySelectorAll(selector || ".glossary-tip.is-placed, .term-tip.is-placed").forEach(clear);
  }

  global.AmaaovTipViewport = {
    place: place,
    clear: clear,
    clearAll: clearAll,
    margin: MARGIN,
  };
})(typeof window !== "undefined" ? window : this);
