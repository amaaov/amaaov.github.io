// Audio routing management class
export class AudioRouter {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.nodes = new Map();
    this.connections = new Map();
    this.routingMap = new Map();
  }

  createNode(name, node) {
    if (this.nodes.has(name)) {
      console.warn(`Node "${name}" already exists`);
      return this.nodes.get(name);
    }

    this.nodes.set(name, node);
    this.connections.set(name, new Set());
    console.log(`Created node: ${name}`);
    return node;
  }

  connect(sourceName, targetName) {
    const source = this.nodes.get(sourceName);
    const target = this.nodes.get(targetName);

    if (!source || !target) {
      console.warn(`Cannot connect ${sourceName} to ${targetName}: nodes not found`);
      return false;
    }

    try {
      if (source.output) {
        source.output.connect(target.input || target);
      } else {
        source.connect(target.input || target);
      }

      this.connections.get(sourceName).add(targetName);
      this.routingMap.set(sourceName, targetName);
      return true;
    } catch (error) {
      console.warn(`Error connecting ${sourceName} to ${targetName}:`, error);
      return false;
    }
  }

  disconnect(sourceName, targetName) {
    const source = this.nodes.get(sourceName);
    const target = this.nodes.get(targetName);

    if (!source || !target) {
      console.warn(`Cannot disconnect ${sourceName} from ${targetName}: nodes not found`);
      return;
    }

    try {
      if (source.output) {
        source.output.disconnect(target.input || target);
      } else {
        source.disconnect(target.input || target);
      }

      this.connections.get(sourceName).delete(targetName);
      if (this.routingMap.get(sourceName) === targetName) {
        this.routingMap.delete(sourceName);
      }
    } catch (error) {
      console.warn(`Error disconnecting ${sourceName} from ${targetName}:`, error);
    }
  }

  cleanup() {
    console.log("Cleaning up audio router...");

    // First, disconnect all nodes
    for (const [sourceName, connections] of this.connections.entries()) {
      for (const targetName of connections) {
        this.disconnect(sourceName, targetName);
      }
    }

    // Then, clean up each node
    for (const [name, node] of this.nodes.entries()) {
      try {
        if (node.cleanup && typeof node.cleanup === 'function') {
          node.cleanup(0.1); // 100ms release time
        } else if (node.disconnect) {
          node.disconnect();
        }
      } catch (error) {
        console.warn(`Error cleaning up node ${name}:`, error);
      }
    }

    // Clear all maps
    this.nodes.clear();
    this.connections.clear();
    this.routingMap.clear();
  }

  printRoutingMap() {
    console.log("\nAudio Routing Map\n================");
    for (const [source, target] of this.routingMap.entries()) {
      console.log(`${source} → ${target}`);
    }
    console.log("");
  }

  getNode(name) {
    return this.nodes.get(name);
  }
}
