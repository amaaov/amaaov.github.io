export const INSPECTOR_MIN_WIDTH = 196;
export const INSPECTOR_MAX_WIDTH = 360;
export const INSPECTOR_DEFAULT_WIDTH = 280;
export const COURT_MIN_WIDTH = 240;

const LABELS = {
  en: {
    settings: "Settings",
    hideSettings: "Settings",
    resizeSettings: "Settings width",
  },
  ru: {
    settings: "Настройки",
    hideSettings: "Настройки",
    resizeSettings: "Ширина настроек",
  },
};

export function fitDisplayCanvas(canvas, pixelRatio, cssWidth, cssHeight) {
  const width = Math.max(1, Math.round(cssWidth * pixelRatio));
  const height = Math.max(1, Math.round(cssHeight * pixelRatio));
  if (canvas.width === width && canvas.height === height) {
    return false;
  }
  canvas.width = width;
  canvas.height = height;
  return true;
}

export function clampInspectorWidth(requested, availableWidth) {
  const ceiling = Math.max(
    INSPECTOR_MIN_WIDTH,
    Math.min(INSPECTOR_MAX_WIDTH, availableWidth - COURT_MIN_WIDTH),
  );
  return Math.min(ceiling, Math.max(INSPECTOR_MIN_WIDTH, requested));
}

export function inspectorWidthFromPointer(pointerX, workspaceLeft, workspaceWidth) {
  return clampInspectorWidth(workspaceLeft + workspaceWidth - pointerX, workspaceWidth);
}

export function applyInspectorLayout(root, { width, collapsed }) {
  root.style.setProperty("--inspector-width", `${width}px`);
  root.classList.toggle("is-inspector-collapsed", collapsed);
}

export function inspectorLabels(language) {
  return language.startsWith("ru") ? LABELS.ru : LABELS.en;
}

export function bindInspectorLayout(root, {
  onLayoutChange,
  language = "en",
  width: storedWidth,
  collapsed: storedCollapsed,
} = {}) {
  const labels = inspectorLabels(language);
  const toggle = root.querySelector("#toggle-inspector");
  const splitter = root.querySelector(".simulator-splitter");
  let width = Number.isFinite(storedWidth)
    ? clampInspectorWidth(storedWidth, 1200)
    : INSPECTOR_DEFAULT_WIDTH;
  let collapsed = typeof storedCollapsed === "boolean" ? storedCollapsed : true;
  let dragging = false;

  function publish() {
    applyInspectorLayout(root, { width, collapsed });
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.textContent = collapsed ? labels.settings : labels.hideSettings;
    }
    if (splitter) {
      splitter.setAttribute("aria-label", labels.resizeSettings);
      splitter.setAttribute("aria-valuenow", String(width));
    }
    onLayoutChange?.();
  }

  toggle?.addEventListener("click", () => {
    collapsed = !collapsed;
    publish();
  });

  splitter?.addEventListener("pointerdown", (event) => {
    if (collapsed) {
      return;
    }
    dragging = true;
    splitter.setPointerCapture(event.pointerId);
  });
  splitter?.addEventListener("pointermove", (event) => {
    if (!dragging) {
      return;
    }
    const bounds = root.getBoundingClientRect();
    width = inspectorWidthFromPointer(event.clientX, bounds.left, bounds.width);
    publish();
  });
  splitter?.addEventListener("pointerup", () => {
    dragging = false;
  });
  splitter?.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 32 : 16;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    const bounds = root.getBoundingClientRect();
    const nextWidth = event.key === "ArrowLeft" ? width + step : width - step;
    width = clampInspectorWidth(nextWidth, bounds.width);
    publish();
  });

  publish();
  return {
    width: () => width,
    collapsed: () => collapsed,
  };
}
