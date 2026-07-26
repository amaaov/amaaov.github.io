const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function shellElements() {
  return document.querySelectorAll("header.top, .cipher-bar, main.stage");
}

/**
 * Side panels with expand toggles, backdrop dismiss, focus return, and Tab cycle.
 */
export function createPanelController(panels, toggles, onClosedFocus) {
  let openPanel = null;
  let returnFocus = null;

  function focusables(panel) {
    return [...panel.querySelectorAll(FOCUSABLE)].filter(
      (node) => !node.hasAttribute("disabled") && node.getClientRects().length > 0,
    );
  }

  function onPanelKeyDown(event) {
    if (event.key !== "Tab" || !openPanel) return;
    const panel = panels[openPanel];
    const items = focusables(panel);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function setShellInert(inert) {
    for (const element of shellElements()) {
      if (inert) element.setAttribute("inert", "");
      else element.removeAttribute("inert");
    }
  }

  function setPanel(name) {
    const previous = openPanel;
    if (previous) {
      panels[previous].removeEventListener("keydown", onPanelKeyDown);
    }

    for (const [key, panel] of Object.entries(panels)) {
      const open = name === key;
      panel.hidden = !open;
      panel.setAttribute("aria-hidden", open ? "false" : "true");
      toggles[key]?.setAttribute("aria-expanded", open ? "true" : "false");
    }

    openPanel = name;
    const backdrop = document.getElementById("backdrop");
    if (backdrop) {
      backdrop.hidden = !name;
      backdrop.setAttribute("aria-hidden", name ? "false" : "true");
    }
    document.body.classList.toggle("panel-open", Boolean(name));
    setShellInert(Boolean(name));

    if (name) {
      returnFocus = document.activeElement;
      const panel = panels[name];
      panel.addEventListener("keydown", onPanelKeyDown);
      const target =
        panel.querySelector("[data-close-panel]") ||
        focusables(panel)[0] ||
        panel;
      target.focus?.();
    } else {
      const restore = toggles[previous] || returnFocus;
      if (restore && typeof restore.focus === "function") restore.focus();
      else onClosedFocus?.();
      returnFocus = null;
    }
  }

  for (const [name, button] of Object.entries(toggles)) {
    button.setAttribute("aria-haspopup", "dialog");
    button.addEventListener("click", () => {
      setPanel(openPanel === name ? null : name);
    });
  }
  document.querySelectorAll("[data-close-panel]").forEach((button) => {
    button.addEventListener("click", () => setPanel(null));
  });
  document.getElementById("backdrop")?.addEventListener("click", () => setPanel(null));

  for (const panel of Object.values(panels)) {
    panel.setAttribute("aria-hidden", "true");
  }

  return {
    setPanel,
    get openPanel() {
      return openPanel;
    },
  };
}
