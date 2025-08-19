/**
 * Scene Manager for RUNNING ENTROPY
 * Orchestrates the sequencing of multiple demoscene scenes
 */

class SceneManager {
    constructor() {
        this.scenes = new Map();
        this.currentScene = null;
        this.currentSceneIndex = 0;
        this.sceneSequence = [];
        this.isTransitioning = false;
        this.transitionDuration = 2000; // 2 seconds
        this.transitionStartTime = 0;
        this.sceneStartTime = 0;

        // Scene timing
        this.minSceneDuration = 60000; // 1 minute minimum
        this.maxSceneDuration = 300000; // 5 minutes maximum

        // Development mode
        this.developmentMode = false;
        this.developmentScene = null;

        // Sequencer UI
        this.sequencerElement = null;
        this.progressBarElement = null;
        this.sceneMarkers = [];

        console.log('🎭 SceneManager initialized - ready to orchestrate the entropy symphony');
    }

    /**
     * Register a scene with the manager
     * @param {string} sceneId - Unique identifier for the scene
     * @param {Scene} scene - Scene instance
     * @param {number} duration - Duration in milliseconds (optional, scene can override)
     */
    registerScene(sceneId, scene, duration = null) {
        this.scenes.set(sceneId, {
            instance: scene,
            duration: duration,
            id: sceneId
        });

        console.log(`🎬 Scene "${sceneId}" registered with duration: ${duration ? duration + 'ms' : 'dynamic'}`);
    }

    /**
     * Set the sequence of scenes to play
     * @param {Array} sceneIds - Array of scene IDs in order
     */
    setSequence(sceneIds) {
        this.sceneSequence = sceneIds.filter(id => this.scenes.has(id));
        console.log(`🎼 Scene sequence set: ${this.sceneSequence.join(' → ')}`);

        // Initialize sequencer UI
        this.initializeSequencerUI();
    }

    /**
     * Initialize sequencer progress bar UI
     */
    initializeSequencerUI() {
        // Create sequencer container if it doesn't exist
        if (!this.sequencerElement) {
            this.sequencerElement = document.createElement('div');
            this.sequencerElement.id = 'sequencer';
            this.sequencerElement.className = 'sequencer-overlay';
            document.body.appendChild(this.sequencerElement);
        }

        // Create progress bar
        this.progressBarElement = document.createElement('div');
        this.progressBarElement.className = 'sequencer-progress';
        this.sequencerElement.appendChild(this.progressBarElement);

        // Create scene markers
        this.createSceneMarkers();

        console.log('🎛️ Sequencer UI initialized');
    }

    /**
     * Create interactive scene markers
     */
    createSceneMarkers() {
        // Clear existing markers
        this.sceneMarkers.forEach(marker => marker.remove());
        this.sceneMarkers = [];

        // Calculate total duration
        let totalDuration = 0;
        this.sceneSequence.forEach(sceneId => {
            const sceneData = this.scenes.get(sceneId);
            const duration = sceneData.duration || sceneData.instance.getDuration();
            totalDuration += duration;
        });

        // Create markers for each scene
        let accumulatedTime = 0;
        this.sceneSequence.forEach((sceneId, index) => {
            const sceneData = this.scenes.get(sceneId);
            const duration = sceneData.duration || sceneData.instance.getDuration();

            const marker = document.createElement('div');
            marker.className = 'scene-marker';
            marker.dataset.sceneIndex = index;
            marker.dataset.sceneId = sceneId;

            // Position marker based on time
            const position = (accumulatedTime / totalDuration) * 100;
            marker.style.left = `${position}%`;

            // Add tooltip
            marker.title = `${sceneId.replace(/_/g, ' ').toUpperCase()} (${Math.floor(duration / 1000)}s)`;

            // Add click handler
            marker.addEventListener('click', () => {
                this.jumpToScene(index);
            });

            // Append to sequencer container instead of progress bar for static positioning
            this.sequencerElement.appendChild(marker);
            this.sceneMarkers.push(marker);

            accumulatedTime += duration;
        });
    }

    /**
     * Update sequencer progress bar
     */
    updateSequencerUI() {
        if (!this.progressBarElement || !this.currentScene) return;

        const sceneInfo = this.getCurrentSceneInfo();
        if (!sceneInfo) return;

        // Calculate overall progress
        let totalElapsed = 0;
        let totalDuration = 0;

        for (let i = 0; i < this.sceneSequence.length; i++) {
            const sceneId = this.sceneSequence[i];
            const sceneData = this.scenes.get(sceneId);
            const duration = sceneData.duration || sceneData.instance.getDuration();

            if (i < sceneInfo.index) {
                totalElapsed += duration;
            } else if (i === sceneInfo.index) {
                totalElapsed += sceneInfo.elapsed;
            }

            totalDuration += duration;
        }

        const overallProgress = (totalElapsed / totalDuration) * 100;

        // Update progress bar
        this.progressBarElement.style.width = `${overallProgress}%`;

        // Update active marker
        this.sceneMarkers.forEach((marker, index) => {
            if (index === sceneInfo.index) {
                marker.classList.add('active');
            } else {
                marker.classList.remove('active');
            }
        });
    }

    /**
     * Enable development mode for single scene testing
     * @param {string} sceneId - Scene ID to test (optional, uses first scene if not specified)
     */
    enableDevelopmentMode(sceneId = null) {
        this.developmentMode = true;
        this.developmentScene = sceneId || this.sceneSequence[0];

        console.log(`🔧 Development mode enabled for scene: "${this.developmentScene}"`);
        console.log('💡 To disable development mode, call sceneManager.disableDevelopmentMode()');

        // Load the development scene
        this.loadScene(this.developmentScene);
    }

    /**
     * Disable development mode
     */
    disableDevelopmentMode() {
        this.developmentMode = false;
        this.developmentScene = null;

        console.log('🔧 Development mode disabled');

        // Restart normal sequence
        this.start();
    }

    /**
     * Start the scene sequence
     */
    start() {
        if (this.sceneSequence.length === 0) {
            console.warn('No scenes in sequence to start');
            return false;
        }

        // In development mode, only load the specified scene
        if (this.developmentMode && this.developmentScene) {
            this.loadScene(this.developmentScene);
            console.log('🚀 Development scene started');
            return true;
        }

        this.currentSceneIndex = 0;
        this.loadScene(this.sceneSequence[0]);
        console.log('🚀 Scene sequence started');
        return true;
    }

    /**
     * Load a specific scene
     * @param {string} sceneId - Scene ID to load
     */
    loadScene(sceneId) {
        const sceneData = this.scenes.get(sceneId);
        if (!sceneData) {
            console.error(`Scene "${sceneId}" not found`);
            return false;
        }

        // Clean up current scene
        if (this.currentScene) {
            this.currentScene.cleanup();
        }

        // Initialize new scene
        this.currentScene = sceneData.instance;
        this.sceneStartTime = performance.now();

        if (this.currentScene.initialize) {
            this.currentScene.initialize();
        }

        console.log(`🎭 Loading scene: "${sceneId}"`);
        return true;
    }

    /**
     * Update the scene manager
     * @param {number} deltaTime - Time since last update
     * @param {number} currentTime - Current time
     */
    update(deltaTime, currentTime) {
        if (!this.currentScene) return;

        // In development mode, don't auto-transition
        if (this.developmentMode) {
            if (this.currentScene.update) {
                this.currentScene.update(deltaTime, currentTime);
            }
            return;
        }

        // Check if scene should transition
        const sceneData = this.scenes.get(this.sceneSequence[this.currentSceneIndex]);
        const sceneDuration = sceneData.duration || this.currentScene.getDuration();
        const sceneElapsed = currentTime - this.sceneStartTime;

        if (sceneElapsed >= sceneDuration) {
            this.nextScene();
            return;
        }

        // Update current scene
        if (this.currentScene.update) {
            this.currentScene.update(deltaTime, currentTime);
        }

        // Update sequencer UI
        this.updateSequencerUI();
    }

    /**
     * Render the current scene
     * @param {WebGLRenderer} renderer - WebGL renderer instance
     */
    render(renderer) {
        if (!this.currentScene || !this.currentScene.render) return;

        // Handle transition effects
        if (this.isTransitioning) {
            const transitionProgress = (performance.now() - this.transitionStartTime) / this.transitionDuration;
            if (transitionProgress >= 1.0) {
                this.isTransitioning = false;
            }
        }

        this.currentScene.render(renderer);
    }

    /**
     * Move to the next scene in sequence
     */
    nextScene() {
        this.currentSceneIndex = (this.currentSceneIndex + 1) % this.sceneSequence.length;
        const nextSceneId = this.sceneSequence[this.currentSceneIndex];

        console.log(`⏭️ Transitioning to scene: "${nextSceneId}"`);
        this.loadScene(nextSceneId);
    }

    /**
     * Move to the previous scene in sequence
     */
    previousScene() {
        this.currentSceneIndex = (this.currentSceneIndex - 1 + this.sceneSequence.length) % this.sceneSequence.length;
        const prevSceneId = this.sceneSequence[this.currentSceneIndex];

        console.log(`⏮️ Transitioning to scene: "${prevSceneId}"`);
        this.loadScene(prevSceneId);
    }

    /**
     * Jump to a specific scene by index
     * @param {number} index - Scene index
     */
    jumpToScene(index) {
        if (index >= 0 && index < this.sceneSequence.length) {
            this.currentSceneIndex = index;
            const sceneId = this.sceneSequence[index];
            console.log(`🎯 Jumping to scene ${index}: "${sceneId}"`);
            this.loadScene(sceneId);
        }
    }

    /**
     * Jump to a specific scene by ID
     * @param {string} sceneId - Scene ID
     */
    jumpToSceneById(sceneId) {
        const index = this.sceneSequence.indexOf(sceneId);
        if (index !== -1) {
            this.jumpToScene(index);
        } else {
            console.error(`Scene "${sceneId}" not found in sequence`);
        }
    }

    /**
     * Get current scene information
     */
    getCurrentSceneInfo() {
        if (!this.currentScene) return null;

        const sceneId = this.sceneSequence[this.currentSceneIndex];
        const sceneData = this.scenes.get(sceneId);

        return {
            id: sceneId,
            index: this.currentSceneIndex,
            total: this.sceneSequence.length,
            duration: sceneData.duration || this.currentScene.getDuration(),
            elapsed: performance.now() - this.sceneStartTime,
            developmentMode: this.developmentMode
        };
    }

    /**
     * Get all scene information for debugging
     */
    getSceneInfo() {
        return {
            totalScenes: this.sceneSequence.length,
            currentScene: this.currentSceneIndex,
            sequence: this.sceneSequence,
            developmentMode: this.developmentMode,
            developmentScene: this.developmentScene
        };
    }

    /**
     * Clean up all scenes
     */
    cleanup() {
        if (this.currentScene && this.currentScene.cleanup) {
            this.currentScene.cleanup();
        }

        this.scenes.forEach(sceneData => {
            if (sceneData.instance.cleanup) {
                sceneData.instance.cleanup();
            }
        });

        // Remove sequencer UI
        if (this.sequencerElement) {
            this.sequencerElement.remove();
            this.sequencerElement = null;
        }

        console.log('🧹 SceneManager cleaned up');
    }
}
