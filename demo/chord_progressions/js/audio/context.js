// Audio context singleton
let audioContext = null;
let userInteractionPromise = null;

// Initialize audio context with user interaction requirement
export async function initAudioContext() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!audioContext) {
      audioContext = new AudioContext({ latencyHint: "interactive" });
      console.log("AudioContext created, state:", audioContext.state);
    }

    // If context is suspended and we don't have a user interaction promise, create one
    if (audioContext.state === "suspended" && !userInteractionPromise) {
      userInteractionPromise = new Promise(resolve => {
        const resumeOnInteraction = async () => {
          if (audioContext.state === "suspended") {
            try {
              await audioContext.resume();
              console.log("AudioContext resumed successfully");

              // Remove event listeners once we've successfully resumed
              ['click', 'touchstart', 'keydown'].forEach(event => {
                document.removeEventListener(event, resumeOnInteraction);
              });

              resolve();
            } catch (error) {
              console.warn("Error resuming AudioContext:", error);
            }
          }
        };

        // Add event listeners for common user interactions
        ['click', 'touchstart', 'keydown'].forEach(event => {
          document.addEventListener(event, resumeOnInteraction, { once: true });
        });

        console.log("Waiting for user interaction to start audio...");
      });
    }

    // If we have a pending user interaction promise, wait for it
    if (userInteractionPromise) {
      await userInteractionPromise;
    }

    return audioContext;
  } catch (error) {
    console.error("Failed to initialize audio context:", error);
    return null;
  }
}

// Get audio context
export function getAudioContext() {
  return audioContext;
}

// Ensure audio context is initialized and running
export async function ensureAudioContext() {
  if (!audioContext) {
    return initAudioContext();
  }

  // Try to resume if suspended
  if (audioContext.state === "suspended") {
    try {
      await audioContext.resume();
      console.log("AudioContext resumed successfully");
    } catch (error) {
      console.warn("Error resuming audio context:", error);
    }
  }

  return audioContext;
}

// Clean up audio context
export function cleanupAudioContext() {
  if (audioContext) {
    try {
      audioContext.close();
    } catch (error) {
      console.warn("Error closing audio context:", error);
    }
    audioContext = null;
    userInteractionPromise = null;
  }
}

// Check if audio context is ready
export function isAudioContextReady() {
  return audioContext && audioContext.state === "running";
}
