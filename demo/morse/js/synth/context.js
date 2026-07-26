let sharedContext = null;

export function getAudioContext() {
  if (!sharedContext) {
    sharedContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (sharedContext.state === "suspended") {
    sharedContext.resume();
  }
  return sharedContext;
}

export async function ensureAudio() {
  const context = getAudioContext();
  if (context.state === "suspended") await context.resume();
  return context;
}
