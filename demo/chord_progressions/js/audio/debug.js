import { getAudioContext } from "./context.js";
import { getChannel } from "./mixer/index.js";

// AudioDebug class for testing and verifying audio connections
export class AudioDebug {
  // Test signal flow through a channel
  static async testSignalFlow(channel) {
    const audioContext = getAudioContext();
    if (!audioContext || !channel) return { inputToOutput: false, outputToDestination: false };

    try {
      // Test input to output flow
      const inputToOutput = await this.testConnection(channel.input, channel.output);

      // Test output to destination flow through the mixer chain
      const outputToDestination = await this.testConnection(channel.output, audioContext.destination);

      return {
        inputToOutput,
        outputToDestination
      };
    } catch (error) {
      console.warn("Error testing signal flow:", error);
      return { inputToOutput: false, outputToDestination: false };
    }
  }

  // Test connection between two nodes
  static async testConnection(sourceNode, destNode) {
    if (!sourceNode || !destNode) return false;

    try {
      const audioContext = getAudioContext();
      const analyser = audioContext.createAnalyser();
      const testOsc = audioContext.createOscillator();
      const testGain = audioContext.createGain();

      // Set up test signal
      testOsc.frequency.value = 440;
      testGain.gain.value = 0.1; // Reduce test signal volume

      // Connect test chain
      testOsc.connect(testGain);
      testGain.connect(sourceNode);

      if (sourceNode.connect) {
        sourceNode.connect(analyser);
      }
      if (destNode.connect) {
        analyser.connect(destNode);
      }

      // Start oscillator and wait for signal
      testOsc.start();
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for signal to propagate

      // Check if we get any signal
      const data = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatTimeDomainData(data);

      // Cleanup
      testOsc.stop();
      testOsc.disconnect();
      testGain.disconnect();
      analyser.disconnect();

      // Check if we have any non-zero values
      const hasSignal = data.some(val => Math.abs(val) > 0.0001);
      if (!hasSignal) {
        console.debug("No signal detected in connection test");
      }
      return hasSignal;
    } catch (error) {
      console.warn("Error testing connection:", error);
      return false;
    }
  }

  // Verify all audio connections
  static async verifyConnections() {
    console.log("\nAudio Connection Verification:");
    console.log("=============================");

    const audioContext = getAudioContext();
    if (!audioContext) {
      console.log("No AudioContext found");
      return false;
    }

    console.log(`AudioContext state: ${audioContext.state}`);

    // Get mixer nodes
    const mixer = window.mixer;
    if (!mixer) {
      console.log("No mixer found");
      return false;
    }

    // Verify required channels exist
    const requiredNodes = ['master', 'chords', 'arpeggiator', 'mainMixer', 'limiter', 'delay', 'reverb'];
    const missingNodes = [];

    requiredNodes.forEach(nodeName => {
      const node = mixer.getNode(nodeName);
      if (!node) {
        console.log(`Channel ${nodeName} not found - this is required`);
        missingNodes.push(nodeName);
      }
    });

    if (missingNodes.length > 0) {
      return false;
    }

    console.log("\nEffects Routing:");

    // Verify delay → reverb connection
    try {
      const delay = mixer.delay;
      const reverb = mixer.reverb;
      const isConnected = await this.testConnection(delay?.output || delay, reverb?.input || reverb);
      console.log(`- Delay → Reverb: ${isConnected}`);
      if (!isConnected) return false;
    } catch (e) {
      console.warn("Error verifying delay → reverb connection:", e);
      return false;
    }

    // Verify reverb → main mixer connection
    try {
      const reverb = mixer.reverb;
      const mainMixer = mixer.mainMixer;
      const isConnected = await this.testConnection(reverb?.output || reverb, mainMixer);
      console.log(`- Reverb → Main mixer: ${isConnected}`);
      if (!isConnected) return false;
    } catch (e) {
      console.warn("Error verifying reverb → main mixer connection:", e);
      return false;
    }

    // Verify main mixer → limiter connection
    try {
      const mainMixer = mixer.mainMixer;
      const limiter = mixer.limiter;
      const isConnected = await this.testConnection(mainMixer, limiter);
      console.log(`- Main mixer → Limiter: ${isConnected}`);
      if (!isConnected) return false;
    } catch (e) {
      console.warn("Error verifying main mixer → limiter connection:", e);
      return false;
    }

    // Verify limiter → master connection
    try {
      const limiter = mixer.limiter;
      const master = mixer.master;
      const isConnected = await this.testConnection(limiter, master?.input || master);
      console.log(`- Limiter → Master: ${isConnected}`);
      if (!isConnected) return false;
    } catch (e) {
      console.warn("Error verifying limiter → master connection:", e);
      return false;
    }

    // Verify master → destination connection
    try {
      const master = mixer.master;
      const isConnected = await this.testConnection(master?.output || master, audioContext.destination);
      console.log(`- Master → Destination: ${isConnected}`);
      if (!isConnected) return false;
    } catch (e) {
      console.warn("Error verifying master → destination connection:", e);
      return false;
    }

    console.log("\nOscilloscope:");
    const leftCanvas = document.getElementById("left-oscilloscope");
    const rightCanvas = document.getElementById("right-oscilloscope");

    if (!leftCanvas || !rightCanvas) {
      console.log("- Oscilloscope canvases not found");
      return false;
    }
    console.log("- Canvas elements found");

    // All checks passed
    console.log("\nAudio routing verification successful!");
    return true;
  }

  // Helper to check if a node is connected to the destination
  static async isConnectedToDestination(node) {
    if (!node) return false;
    return this.testConnection(node, getAudioContext()?.destination);
  }

  // Helper to check if two nodes are connected
  static async isConnectedToNode(sourceNode, destNode) {
    if (!sourceNode || !destNode) return false;
    return this.testConnection(sourceNode, destNode);
  }
}
