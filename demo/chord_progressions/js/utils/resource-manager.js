// Resource tracking
class ResourceManager {
  constructor() {
    this.eventListeners = new Map();
    this.intervals = new Set();
    this.timeouts = new Set();
    this.audioNodes = new Set();
    this.disposables = new Set();
  }

  // Track event listener
  addEventListenerTracked(element, event, handler, options = {}) {
    element.addEventListener(event, handler, options);
    if (!this.eventListeners.has(element)) {
      this.eventListeners.set(element, new Map());
    }
    this.eventListeners.get(element).set(event, { handler, options });
  }

  // Remove tracked event listener
  removeEventListenerTracked(element, event) {
    if (this.eventListeners.has(element)) {
      const listeners = this.eventListeners.get(element);
      if (listeners.has(event)) {
        const { handler, options } = listeners.get(event);
        element.removeEventListener(event, handler, options);
        listeners.delete(event);
        if (listeners.size === 0) {
          this.eventListeners.delete(element);
        }
      }
    }
  }

  // Track interval
  setIntervalTracked(callback, delay) {
    const id = setInterval(callback, delay);
    this.intervals.add(id);
    return id;
  }

  // Track timeout
  setTimeoutTracked(callback, delay) {
    const id = setTimeout(callback, delay);
    this.timeouts.add(id);
    return id;
  }

  // Track audio node
  trackAudioNode(node) {
    if (node) {
      this.audioNodes.add(node);
    }
    return node;
  }

  // Track disposable resource
  trackDisposable(resource) {
    if (resource && typeof resource.dispose === 'function') {
      this.disposables.add(resource);
    }
    return resource;
  }

  // Clean up all tracked resources
  cleanup() {
    // Clean up event listeners
    this.eventListeners.forEach((listeners, element) => {
      listeners.forEach(({ handler, options }, event) => {
        element.removeEventListener(event, handler, options);
      });
    });
    this.eventListeners.clear();

    // Clear intervals
    this.intervals.forEach(id => clearInterval(id));
    this.intervals.clear();

    // Clear timeouts
    this.timeouts.forEach(id => clearTimeout(id));
    this.timeouts.clear();

    // Clean up audio nodes
    this.audioNodes.forEach(node => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch (error) {
        console.warn("Error cleaning up audio node:", error);
      }
    });
    this.audioNodes.clear();

    // Dispose of resources
    this.disposables.forEach(resource => {
      try {
        resource.dispose();
      } catch (error) {
        console.warn("Error disposing resource:", error);
      }
    });
    this.disposables.clear();
  }
}

// Create singleton instance
const resourceManager = new ResourceManager();

export default resourceManager;
