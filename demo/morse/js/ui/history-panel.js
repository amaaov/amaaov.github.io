function preview(entry) {
  const text = entry.text || "";
  const morse = entry.morse || "";
  const label = text || morse;
  return label.length > 72 ? `${label.slice(0, 69)}…` : label || "(empty)";
}

function formatTime(at) {
  try {
    return new Date(at).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function bindHistoryPanel({
  list,
  enableToggle,
  clearButton,
  emptyHint,
  store,
  onRestore,
  announce,
}) {
  function render({ enabled, entries }) {
    enableToggle.checked = enabled;
    clearButton.disabled = entries.length === 0;
    emptyHint.hidden = entries.length > 0;
    list.replaceChildren(
      ...entries.map((entry) => {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "history-item";
        const previewSpan = document.createElement("span");
        previewSpan.className = "history-preview";
        previewSpan.textContent = preview(entry);
        const metaSpan = document.createElement("span");
        metaSpan.className = "history-meta";
        metaSpan.textContent = `${formatTime(entry.at)} · ${entry.inputMode}`;
        button.append(previewSpan, metaSpan);
        button.addEventListener("click", () => onRestore(entry));
        item.append(button);
        return item;
      }),
    );
  }

  enableToggle.addEventListener("change", () => {
    store.setEnabled(enableToggle.checked);
    announce(enableToggle.checked ? "History on" : "History off");
  });
  clearButton.addEventListener("click", () => {
    store.clear();
    announce("History cleared");
  });

  return store.subscribe(render);
}
