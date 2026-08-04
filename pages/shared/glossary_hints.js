/**
 * Interactive glossary hints for amaaov article pages.
 * Hover / focus / touch tips + icon toggle (hints on/off).
 *
 * AmaaovGlossary.init({
 *   storageKey: "amaaov-hints:slug",
 *   root: "#main",
 *   terms: [{
 *     match: "siteswap",
 *     tip: "Rhythmic throw schedule…",
 *     wikipedia: "Siteswap",
 *     juggleWiki: "Siteswap",
 *     // or links: [{ href: "https://…", label: "Wikipedia" }]
 *   }, …],
 *   firstOnly: false,
 *   defaultOn: true,
 *   enhanceSelector: ".term",
 *   toggle: { mount: ".site-top", ariaLabel: "Glossary hints" }
 * });
 */
(function (global) {
  "use strict";

  var SKIP_TAGS = {
    SCRIPT: 1,
    STYLE: 1,
    NOSCRIPT: 1,
    TEXTAREA: 1,
    INPUT: 1,
    SELECT: 1,
    OPTION: 1,
    CODE: 1,
    KBD: 1,
    SAMP: 1,
    PRE: 1,
    SVG: 1,
    MATH: 1,
    BUTTON: 1,
    LABEL: 1,
    H1: 1,
  };

  var SKIP_CLASSES = {
    "article-subtitle": 1,
    "article-head": 1,
    "page-lede": 1,
    "glossary-hints-toggle": 1,
    "glossary-term": 1,
  };

  var ICON_ON =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12" r="9"></circle>' +
    '<path d="M12 10.2v5.3"></path>' +
    '<circle cx="12" cy="7.4" r="0.85" fill="currentColor" stroke="none"></circle>' +
    "</svg>";

  var ICON_OFF =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12" r="9"></circle>' +
    '<path d="M12 10.2v5.3"></path>' +
    '<circle cx="12" cy="7.4" r="0.85" fill="currentColor" stroke="none"></circle>' +
    '<path d="M6.2 6.2l11.6 11.6"></path>' +
    "</svg>";

  var ALLOWED_LINK_HOSTS = {
    "amaaov.github.io": 1,
    "amkisko.github.io": 1,
    "juggle.fandom.com": 1,
    "www.juggling.wiki": 1,
    "juggling.wiki": 1,
  };

  function isAllowedHost(hostname) {
    if (!hostname) return false;
    if (ALLOWED_LINK_HOSTS[hostname]) return true;
    return /\.wikipedia\.org$/i.test(hostname);
  }

  function isElement(node) {
    return node && node.nodeType === 1;
  }

  function safeHttpUrl(raw) {
    if (!raw) return "";
    var href = String(raw).trim();
    if (!/^https:\/\//i.test(href)) return "";
    try {
      var u = new URL(href);
      if (u.protocol !== "https:") return "";
      if (!isAllowedHost(u.hostname)) return "";
      return u.href;
    } catch (err) {
      return "";
    }
  }

  function wikiUrl(kind, value) {
    if (!value) return "";
    var raw = String(value).trim();
    if (/^https:\/\//i.test(raw)) return safeHttpUrl(raw);
    var slug = encodeURIComponent(raw.replace(/ /g, "_"));
    if (kind === "wikipedia") {
      return safeHttpUrl("https://en.wikipedia.org/wiki/" + slug);
    }
    if (kind === "juggleWiki") {
      return safeHttpUrl("https://juggle.fandom.com/wiki/" + slug);
    }
    return "";
  }

  function normalizeLinks(item) {
    var links = [];
    var seen = {};
    function pushLink(href, label) {
      var safe = safeHttpUrl(href);
      if (!safe || seen[safe]) return;
      seen[safe] = 1;
      links.push({ href: safe, label: label || "More" });
    }
    if (!item || typeof item !== "object") return links;
    if (item.wikipedia) pushLink(wikiUrl("wikipedia", item.wikipedia), "Wikipedia");
    if (item.juggleWiki || item.wikia) {
      pushLink(wikiUrl("juggleWiki", item.juggleWiki || item.wikia), "Juggle Wiki");
    }
    if (item.href) pushLink(item.href, item.linkLabel || "More");
    if (Array.isArray(item.links)) {
      item.links.forEach(function (link) {
        if (!link) return;
        if (typeof link === "string") pushLink(link, "More");
        else pushLink(link.href || link.url, link.label || link.title || "More");
      });
    }
    return links;
  }

  function normalizeTerms(raw) {
    var list = [];
    if (!raw) return list;
    if (Array.isArray(raw)) {
      raw.forEach(function (item) {
        if (!item) return;
        if (typeof item === "string") return;
        var match = item.match || item.term || item.word || "";
        var tip = item.tip || item.def || item.definition || "";
        if (!match || !tip) return;
        list.push({
          match: String(match),
          tip: String(tip),
          links: normalizeLinks(item),
        });
      });
      return list;
    }
    Object.keys(raw).forEach(function (key) {
      var val = raw[key];
      if (!val) return;
      if (typeof val === "string") {
        list.push({ match: key, tip: val, links: [] });
        return;
      }
      var tip = val.tip || val.def || val.definition || "";
      if (!tip) return;
      list.push({
        match: key,
        tip: String(tip),
        links: normalizeLinks(val),
      });
    });
    return list;
  }

  function isWordChar(ch) {
    if (!ch) return false;
    return /[0-9A-Za-z\u00C0-\u024F\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u3040-\u30FF\u4E00-\u9FFF_'’-]/.test(
      ch
    );
  }

  function hasSkipClass(el) {
    if (!el || !el.classList) return false;
    var i;
    for (i = 0; i < el.classList.length; i++) {
      if (SKIP_CLASSES[el.classList[i]]) return true;
    }
    return false;
  }

  function closestSkippable(node, root) {
    var el = isElement(node) ? node : node.parentElement;
    while (el && el !== root) {
      if (SKIP_TAGS[el.tagName]) return true;
      if (hasSkipClass(el)) return true;
      if (el.getAttribute && el.getAttribute("data-glossary-skip") != null) return true;
      if (el.tagName === "A") return true;
      el = el.parentElement;
    }
    return false;
  }

  function collectTextNodes(root) {
    var out = [];
    if (!root) return out;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (closestSkippable(node, root)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    var n;
    while ((n = walker.nextNode())) out.push(n);
    return out;
  }

  function fillTipEl(tipEl, tip, links) {
    tipEl.textContent = "";
    tipEl.appendChild(document.createTextNode(tip));
    if (!links || !links.length) return;
    tipEl.classList.add("has-links");
    var row = document.createElement("span");
    row.className = "glossary-tip-links";
    links.forEach(function (link, i) {
      if (i) row.appendChild(document.createTextNode(" · "));
      var a = document.createElement("a");
      a.href = link.href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = link.label;
      row.appendChild(a);
    });
    tipEl.appendChild(row);
  }

  function makeTermSpan(surface, tip, links) {
    var span = document.createElement("span");
    span.className = "glossary-term";
    span.setAttribute("tabindex", "0");
    span.setAttribute("data-glossary-term", surface);
    span.setAttribute("data-glossary-tip", tip);
    span.setAttribute("aria-label", surface + ": " + tip);
    span.appendChild(document.createTextNode(surface));
    var tipEl = document.createElement("span");
    tipEl.className = "glossary-tip";
    tipEl.setAttribute("role", "tooltip");
    tipEl.setAttribute("aria-hidden", "true");
    fillTipEl(tipEl, tip, links);
    span.appendChild(tipEl);
    return span;
  }

  function findTermFrom(text, term, from) {
    var low = text.toLowerCase();
    var needle = term.match.toLowerCase();
    var idx = low.indexOf(needle, from);
    while (idx >= 0) {
      var end = idx + term.match.length;
      var before = idx === 0 ? "" : text.charAt(idx - 1);
      var after = end >= text.length ? "" : text.charAt(end);
      if (!isWordChar(before) && !isWordChar(after)) {
        return {
          index: idx,
          surface: text.slice(idx, end),
          tip: term.tip,
          links: term.links || [],
          key: needle,
        };
      }
      idx = low.indexOf(needle, idx + 1);
    }
    return null;
  }

  function findNextMatch(text, from, terms) {
    var best = null;
    var i;
    for (i = 0; i < terms.length; i++) {
      var hit = findTermFrom(text, terms[i], from);
      if (!hit) continue;
      if (
        !best ||
        hit.index < best.index ||
        (hit.index === best.index && hit.surface.length > best.surface.length)
      ) {
        best = hit;
      }
    }
    return best;
  }

  function wrapTextNode(node, terms, used, firstOnly) {
    var text = node.nodeValue;
    if (!text || !node.parentNode) return;
    var frag = null;
    var last = 0;
    var guard = 0;
    while (guard++ < 2000) {
      var hit = findNextMatch(text, last, terms);
      if (!hit) break;
      if (firstOnly && used[hit.key]) {
        last = hit.index + hit.surface.length;
        continue;
      }
      if (!frag) frag = document.createDocumentFragment();
      if (hit.index > last) {
        frag.appendChild(document.createTextNode(text.slice(last, hit.index)));
      }
      frag.appendChild(makeTermSpan(hit.surface, hit.tip, hit.links));
      used[hit.key] = true;
      last = hit.index + hit.surface.length;
    }
    if (!frag) return;
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }

  function tipMapFromTerms(terms) {
    var map = {};
    terms.forEach(function (t) {
      map[t.match.toLowerCase()] = { tip: t.tip, links: t.links || [] };
    });
    return map;
  }

  function enhanceExisting(root, selector, tipMap, used, firstOnly) {
    if (!root || !selector) return;
    var nodes = root.querySelectorAll(selector);
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.classList.contains("glossary-term")) return;
      if (el.querySelector(".glossary-tip")) return;
      if (closestSkippable(el, root)) return;
      var surface = "";
      var child = el.firstChild;
      while (child) {
        if (child.nodeType === 3) surface += child.nodeValue;
        child = child.nextSibling;
      }
      surface = surface.trim();
      if (!surface) return;
      var key = surface.toLowerCase();
      var entry = tipMap[key];
      if (!entry) return;
      if (firstOnly && used[key]) return;
      used[key] = true;
      el.classList.add("glossary-term");
      el.setAttribute("tabindex", "0");
      el.setAttribute("data-glossary-term", surface);
      el.setAttribute("data-glossary-tip", entry.tip);
      el.setAttribute("aria-label", surface + ": " + entry.tip);
      var tipEl = document.createElement("span");
      tipEl.className = "glossary-tip";
      tipEl.setAttribute("role", "tooltip");
      tipEl.setAttribute("aria-hidden", "true");
      fillTipEl(tipEl, entry.tip, entry.links);
      el.appendChild(tipEl);
    });
  }

  function setToggleIcon(icon, on) {
    icon.innerHTML = on ? ICON_ON : ICON_OFF;
  }

  function createToggle(opts, enabled, onChange) {
    var mount =
      typeof opts.mount === "string"
        ? document.querySelector(opts.mount)
        : opts.mount;
    if (!mount) return null;

    var label = document.createElement("label");
    label.className = "glossary-hints-toggle";
    if (opts.className) label.className += " " + opts.className;
    label.title = opts.ariaLabel || opts.labelOn || "Glossary hints";

    var input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!enabled;
    input.setAttribute(
      "aria-label",
      opts.ariaLabel || opts.labelOn || "Glossary hints"
    );

    var icon = document.createElement("span");
    icon.className = "glossary-hints-toggle-icon";
    icon.setAttribute("aria-hidden", "true");
    setToggleIcon(icon, enabled);

    label.appendChild(input);
    label.appendChild(icon);

    if (opts.prepend) mount.insertBefore(label, mount.firstChild);
    else mount.appendChild(label);

    input.addEventListener("change", function () {
      var on = !!input.checked;
      setToggleIcon(icon, on);
      label.classList.toggle("is-off", !on);
      onChange(on);
    });
    label.classList.toggle("is-off", !enabled);

    return { label: label, input: input };
  }

  function applyEnabled(on) {
    document.documentElement.classList.toggle("glossary-hints-off", !on);
    document.querySelectorAll(".glossary-term.is-tip-open, .glossary-term.is-hovering").forEach(function (el) {
      el.classList.remove("is-tip-open");
      el.classList.remove("is-hovering");
      var tip = el.querySelector(".glossary-tip");
      if (tip) {
        tip.setAttribute("aria-hidden", "true");
        if (global.AmaaovTipViewport) global.AmaaovTipViewport.clear(tip);
      }
    });
  }

  function closeTerm(el) {
    if (!el) return;
    el.classList.remove("is-tip-open");
    el.classList.remove("is-hovering");
    var tip = el.querySelector(".glossary-tip");
    if (tip) {
      tip.setAttribute("aria-hidden", "true");
      if (global.AmaaovTipViewport) global.AmaaovTipViewport.clear(tip);
    }
  }

  function openOrPlace(term) {
    var tip = term.querySelector(".glossary-tip");
    if (!tip) return;
    tip.setAttribute("aria-hidden", "false");
    if (global.AmaaovTipViewport) {
      requestAnimationFrame(function () {
        global.AmaaovTipViewport.place(term, tip);
      });
    }
  }

  function bindTips(root) {
    if (!root || root.getAttribute("data-glossary-bound") === "1") return;
    root.setAttribute("data-glossary-bound", "1");

    var hoverClearTimer = null;
    var hoverTerm = null;

    function clearHoverSoon(term) {
      if (hoverClearTimer) clearTimeout(hoverClearTimer);
      hoverClearTimer = setTimeout(function () {
        hoverClearTimer = null;
        if (!term) return;
        term.classList.remove("is-hovering");
        if (hoverTerm === term) hoverTerm = null;
        if (term.classList.contains("is-tip-open")) return;
        var tip = term.querySelector(".glossary-tip");
        if (tip && global.AmaaovTipViewport) global.AmaaovTipViewport.clear(tip);
      }, 200);
    }

    function setHover(term) {
      if (hoverClearTimer) {
        clearTimeout(hoverClearTimer);
        hoverClearTimer = null;
      }
      if (hoverTerm && hoverTerm !== term) {
        hoverTerm.classList.remove("is-hovering");
        if (!hoverTerm.classList.contains("is-tip-open")) {
          var prevTip = hoverTerm.querySelector(".glossary-tip");
          if (prevTip && global.AmaaovTipViewport) global.AmaaovTipViewport.clear(prevTip);
        }
      }
      hoverTerm = term;
      term.classList.add("is-hovering");
      openOrPlace(term);
    }

    function closeOthers(except) {
      document.querySelectorAll(".glossary-term.is-tip-open").forEach(function (el) {
        if (el === except) return;
        closeTerm(el);
      });
    }

    document.addEventListener("click", function (e) {
      if (document.documentElement.classList.contains("glossary-hints-off")) return;
      if (e.target.closest && e.target.closest(".glossary-tip a")) return;
      var term = e.target.closest ? e.target.closest(".glossary-term") : null;
      closeOthers(term);
      if (!term || !root.contains(term)) return;
      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      e.preventDefault();
      var open = !term.classList.contains("is-tip-open");
      if (!open) {
        closeTerm(term);
        return;
      }
      term.classList.add("is-tip-open");
      openOrPlace(term);
    });

    document.addEventListener(
      "mouseover",
      function (e) {
        if (document.documentElement.classList.contains("glossary-hints-off")) return;
        if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
        var term = e.target.closest ? e.target.closest(".glossary-term") : null;
        if (!term || !root.contains(term)) return;
        setHover(term);
      },
      true
    );

    document.addEventListener(
      "mouseout",
      function (e) {
        var term = e.target.closest ? e.target.closest(".glossary-term") : null;
        if (!term || !root.contains(term)) return;
        var next = e.relatedTarget;
        if (next && term.contains(next)) return;
        if (term.classList.contains("is-tip-open")) return;
        clearHoverSoon(term);
      },
      true
    );

    document.addEventListener("focusin", function (e) {
      if (document.documentElement.classList.contains("glossary-hints-off")) return;
      var term = e.target.closest ? e.target.closest(".glossary-term") : null;
      if (!term || !root.contains(term)) return;
      setHover(term);
    });

    document.addEventListener("focusout", function (e) {
      var term = e.target.closest ? e.target.closest(".glossary-term") : null;
      if (!term || !root.contains(term)) return;
      if (term.classList.contains("is-tip-open")) return;
      var next = e.relatedTarget;
      if (next && term.contains(next)) return;
      clearHoverSoon(term);
    });

    window.addEventListener(
      "scroll",
      function () {
        document.querySelectorAll(".glossary-term.is-tip-open, .glossary-term.is-hovering").forEach(function (el) {
          el.classList.remove("is-hovering");
          closeTerm(el);
        });
        if (global.AmaaovTipViewport) global.AmaaovTipViewport.clearAll(".glossary-tip.is-placed");
      },
      true
    );

    window.addEventListener("resize", function () {
      document
        .querySelectorAll(".glossary-term.is-tip-open, .glossary-term.is-hovering")
        .forEach(function (term) {
          openOrPlace(term);
        });
    });
  }

  function resolveRoot(root) {
    if (!root) return document.body;
    if (typeof root === "string") return document.querySelector(root) || document.body;
    return root;
  }

  function init(options) {
    options = options || {};
    var terms = normalizeTerms(options.terms);
    if (!terms.length) return null;

    terms.sort(function (a, b) {
      return b.match.length - a.match.length;
    });

    var root = resolveRoot(options.root);
    var firstOnly = !!options.firstOnly;
    var storageKey = options.storageKey || "amaaov-glossary-hints";
    var defaultOn = options.defaultOn !== false;
    var saved = null;
    try {
      saved = localStorage.getItem(storageKey);
    } catch (err) {
      saved = null;
    }
    var enabled = saved === null ? defaultOn : saved === "1";
    var tipMap = tipMapFromTerms(terms);
    var used = {};

    enhanceExisting(
      root,
      options.enhanceSelector === undefined ? ".term" : options.enhanceSelector,
      tipMap,
      used,
      firstOnly
    );
    collectTextNodes(root).forEach(function (node) {
      wrapTextNode(node, terms, used, firstOnly);
    });

    var termCount = root.querySelectorAll
      ? root.querySelectorAll(".glossary-term").length
      : 0;
    if (!termCount) return null;

    applyEnabled(enabled);
    bindTips(root);

    if (options.toggle) {
      createToggle(options.toggle, enabled, function (on) {
        try {
          localStorage.setItem(storageKey, on ? "1" : "0");
        } catch (err) {}
        applyEnabled(on);
      });
    }

    return {
      setEnabled: function (on) {
        applyEnabled(!!on);
        try {
          localStorage.setItem(storageKey, on ? "1" : "0");
        } catch (err) {}
      },
      isEnabled: function () {
        return !document.documentElement.classList.contains("glossary-hints-off");
      },
      termCount: termCount,
    };
  }

  global.AmaaovGlossary = { init: init };
})(typeof window !== "undefined" ? window : this);
