/**
 * Arrow / Home / End navigation for role=tablist (roving tabindex assumed).
 */
export function bindTablist(tablist, onActivate) {
  if (!tablist) return () => {};

  function onKeyDown(event) {
    const tabs = [...tablist.querySelectorAll('[role="tab"]:not([disabled])')];
    const index = tabs.indexOf(event.target);
    if (index < 0) return;

    let nextIndex = -1;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (index + 1) % tabs.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const next = tabs[nextIndex];
    onActivate?.(next);
    next.focus();
  }

  tablist.addEventListener("keydown", onKeyDown);
  return () => tablist.removeEventListener("keydown", onKeyDown);
}
