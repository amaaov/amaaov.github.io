/** Court-only face: one canvas, no panel chrome. */

export function mountStageFace(root) {
  root.innerHTML = "";
  root.classList.add("stage-root");

  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = 240;
  canvas.className = "stage-court";
  canvas.setAttribute("aria-label", "Holding Topology court");
  root.appendChild(canvas);

  const noop = () => {};

  return {
    screen: canvas,
    setKnobValue: noop,
    setButtonLit: noop,
    setKeyLit: noop,
  };
}
