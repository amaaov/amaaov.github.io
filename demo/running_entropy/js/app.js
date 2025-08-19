/**
 * RUNNING ENTROPY - Main Application
 * Orchestrates all components and manages the game loop with scene-based architecture
 */

class RunningEntropyApp {
    constructor() {
        this.isInitialized = false;
        this.isRunning = false;
        this.isPaused = false;

        // Core components
        this.canvas = null;
        this.renderer = null;
        this.inputManager = null;
        this.gamepadHandler = null;
        this.noiseGenerator = null;
        this.sceneManager = null;

        // Timing
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.fps = 0;
        this.fpsUpdateInterval = performance.now();
        this.time = 0;

        // UI state
        this.showInfo = false;
        this.showStats = false;

        console.log('🎭 RUNNING ENTROPY app constructor called - preparing for demoscene symphony');
    }

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            Utils.showLoading();

            // Check WebGL support
            if (!Utils.isWebGLSupported()) {
                throw new Error('WebGL is not supported in this browser');
            }

            // Get canvas element
            this.canvas = document.getElementById('gl-canvas');
            if (!this.canvas) {
                throw new Error('Canvas element not found');
            }

            // Initialize core components
            await this.initializeComponents();

            // Initialize scene manager and scenes
            this.initializeScenes();

            // Set up window resize handler
            window.addEventListener('resize', this.handleResize.bind(this));

            // Resize canvas to fit window
            this.resizeCanvas();

            // Ensure WebGL viewport is set correctly
            if (this.renderer) {
                this.renderer.handleResize();
            }

            this.isInitialized = true;
            console.log('🎭 RUNNING ENTROPY application initialized successfully');

            // Hide loading screen
            Utils.hideLoading();

            return true;

        } catch (error) {
            console.error('Failed to initialize application:', error);
            Utils.showError(`Application initialization failed: ${error.message}`, 'Initialization Error');
            return false;
        }
    }

    /**
     * Initialize core components
     */
    async initializeComponents() {
        // Initialize WebGL renderer
        this.renderer = new WebGLRenderer(this.canvas);
        if (!this.renderer.initialize()) {
            throw new Error('Failed to initialize WebGL renderer');
        }

        // Initialize input manager
        this.inputManager = new InputManager(this.canvas);
        if (!this.inputManager.initialize()) {
            throw new Error('Failed to initialize input manager');
        }

        // Initialize gamepad handler
        this.gamepadHandler = new GamepadHandler();
        if (!this.gamepadHandler.initialize()) {
            console.warn('Gamepad support not available');
        }

        // Initialize noise generator
        this.noiseGenerator = new NoiseGenerator();
        // Temporarily disable noise generator until we add it back
        // if (!this.noiseGenerator.initialize()) {
        //     throw new Error('Failed to initialize noise generator');
        // }

        console.log('🎬 All core components initialized');
    }

    /**
     * Initialize scene manager and register scenes
     */
    initializeScenes() {
        this.sceneManager = new SceneManager();

        // Register scenes
        this.sceneManager.registerScene('entropy_magma', new EntropyMagmaScene());
        this.sceneManager.registerScene('geometric_entropy', new GeometricEntropyScene());
        this.sceneManager.registerScene('particle_entropy', new ParticleEntropyScene());

        // Set scene sequence
        this.sceneManager.setSequence([
            'entropy_magma',
            'geometric_entropy',
            'particle_entropy'
        ]);

        console.log('🎭 Scene manager initialized with demoscene sequence');
    }

    /**
     * Start the application
     */
    start() {
        if (!this.isInitialized) {
            console.error('Application not initialized');
            return false;
        }

        if (this.isRunning) {
            console.warn('Application already running');
            return false;
        }

        this.isRunning = true;
        this.lastFrameTime = Utils.getTimestamp();

        // Start scene sequence
        this.sceneManager.start();

        console.log('🚀 Starting RUNNING ENTROPY demoscene sequence');
        this.gameLoop();

        return true;
    }

    /**
     * Stop the application
     */
    stop() {
        this.isRunning = false;
        console.log('⏹️ Stopping RUNNING ENTROPY application');
    }

    /**
     * Main game loop
     * @param {number} currentTime - Current time in milliseconds
     */
    gameLoop(currentTime) {
        if (!this.isRunning) return;

        // Calculate delta time
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;

        // Update game state
        this.update(deltaTime, currentTime);

        // Render frame
        this.render();

        // Continue loop
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    /**
     * Update application state
     * @param {number} deltaTime - Time since last update in milliseconds
     * @param {number} currentTime - Current time in milliseconds
     */
    update(deltaTime, currentTime) {
        // Update time
        this.time += deltaTime * 0.001;

        // Update input manager
        this.inputManager.update();

        // Update gamepad handler
        if (this.gamepadHandler) {
            this.gamepadHandler.update();
        }

        // Update scene manager
        if (this.sceneManager) {
            this.sceneManager.update(deltaTime, currentTime);

            // Pass input state to current scene
            const currentScene = this.sceneManager.currentScene;
            if (currentScene) {
                currentScene.setInputState(this.getInputState());
            }
        }

        // Update FPS counter
        this.updateFPS(currentTime);

        // Handle input for scene navigation
        this.handleSceneNavigation();
    }

    /**
     * Render the current frame
     */
    render() {
        if (!this.renderer || !this.isRunning) return;

        // Update renderer with current scene's shader
        const currentScene = this.sceneManager.currentScene;
        if (currentScene) {
            // Update shader if needed
            const fragmentShader = currentScene.getFragmentShader();
            const vertexShader = currentScene.getVertexShader();

            if (fragmentShader && vertexShader) {
                this.renderer.updateShaders(vertexShader, fragmentShader);
            }
        }

        // Render current scene
        this.sceneManager.render(this.renderer);

        // Update UI
        this.updateUI();
    }

    /**
     * Get current input state
     */
    getInputState() {
        const inputState = this.inputManager.getInputState();
        return {
            mouse: inputState.mouse,
            touch: inputState.touch,
            keys: inputState.keyboard,
            gamepad: this.gamepadHandler ? this.gamepadHandler.getPrimaryInput() : null
        };
    }

    /**
     * Handle scene navigation input
     */
    handleSceneNavigation() {
        // Next scene
        if (this.inputManager.isKeyPressed('ArrowRight') || this.inputManager.isKeyPressed(' ')) {
            this.sceneManager.nextScene();
        }

        // Previous scene
        if (this.inputManager.isKeyPressed('ArrowLeft')) {
            this.sceneManager.previousScene();
        }

        // Jump to specific scenes
        if (this.inputManager.isKeyPressed('1')) {
            this.sceneManager.jumpToScene(0);
        }
        if (this.inputManager.isKeyPressed('2')) {
            this.sceneManager.jumpToScene(1);
        }
        if (this.inputManager.isKeyPressed('3')) {
            this.sceneManager.jumpToScene(2);
        }

        // Development mode controls
        if (this.inputManager.isKeyPressed('d')) {
            this.toggleDevelopmentMode();
        }

        // Toggle info
        if (this.inputManager.isKeyPressed('i')) {
            this.toggleInfo();
        }

        // Toggle stats
        if (this.inputManager.isKeyPressed('s')) {
            this.toggleStats();
        }

        // Toggle sequencer
        if (this.inputManager.isKeyPressed('q')) {
            this.toggleSequencer();
        }

        // Fullscreen
        if (this.inputManager.isKeyPressed('f')) {
            this.toggleFullscreen();
        }
    }

    /**
     * Toggle development mode
     */
    toggleDevelopmentMode() {
        if (this.sceneManager.developmentMode) {
            this.sceneManager.disableDevelopmentMode();
            this.hideDevelopmentIndicator();
        } else {
            // Enable development mode for current scene
            const sceneInfo = this.sceneManager.getCurrentSceneInfo();
            if (sceneInfo) {
                this.sceneManager.enableDevelopmentMode(sceneInfo.id);
                this.showDevelopmentIndicator(sceneInfo.id);
            }
        }
    }

    /**
     * Show development mode indicator
     */
    showDevelopmentIndicator(sceneId) {
        let indicator = document.getElementById('development-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'development-indicator';
            indicator.className = 'development-mode-indicator';
            document.body.appendChild(indicator);
        }
        indicator.textContent = `DEV: ${sceneId.replace(/_/g, ' ').toUpperCase()}`;
        indicator.style.display = 'block';
    }

    /**
     * Hide development mode indicator
     */
    hideDevelopmentIndicator() {
        const indicator = document.getElementById('development-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    /**
     * Toggle sequencer visibility
     */
    toggleSequencer() {
        const sequencer = document.getElementById('sequencer');
        if (sequencer) {
            sequencer.style.display = sequencer.style.display === 'none' ? 'block' : 'none';
        }
    }

    /**
     * Update UI elements
     */
    updateUI() {
        if (this.showInfo) {
            const sceneInfo = this.sceneManager.getCurrentSceneInfo();
            if (sceneInfo) {
                this.updateSceneInfo(sceneInfo);
            }
        }

        if (this.showStats) {
            this.updateStats();
        }
    }

    /**
     * Update scene information display
     */
    updateSceneInfo(sceneInfo) {
        const infoElement = document.getElementById('scene-info');
        if (infoElement && this.showInfo) {
            const progress = Math.floor(sceneInfo.elapsed / sceneInfo.duration * 100);
            infoElement.innerHTML = `
                <div class="scene-info">
                    <div class="scene-name">${sceneInfo.id.replace(/_/g, ' ').toUpperCase()}</div>
                    <div class="scene-progress">${sceneInfo.index + 1}/${sceneInfo.total} - ${progress}%</div>
                    <div class="scene-time">${Math.floor(sceneInfo.elapsed / 1000)}s / ${Math.floor(sceneInfo.duration / 1000)}s</div>
                </div>
            `;
        }
    }

    /**
     * Update statistics display
     */
    updateStats() {
        const statsElement = document.getElementById('stats');
        if (statsElement) {
            const currentScene = this.sceneManager.currentScene;
            const sceneInfo = currentScene ? currentScene.getInfo() : null;

            statsElement.innerHTML = `
                <div class="stats">
                    <div>FPS: ${this.fps.toFixed(1)}</div>
                    <div>Frame: ${this.frameCount}</div>
                    <div>Time: ${this.time.toFixed(1)}s</div>
                    ${sceneInfo ? `<div>Scene: ${sceneInfo.name}</div>` : ''}
                    ${sceneInfo ? `<div>Progress: ${(sceneInfo.progress * 100).toFixed(1)}%</div>` : ''}
                </div>
            `;
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        this.resizeCanvas();
        if (this.renderer) {
            this.renderer.handleResize();
        }
    }

    /**
     * Resize canvas to fit window
     */
    resizeCanvas() {
        if (!this.canvas) return;

        const displayWidth = window.innerWidth;
        const displayHeight = window.innerHeight;

        console.log(`🖼️ Resizing canvas to ${displayWidth}x${displayHeight}`);

        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;

            console.log(`🎯 Canvas dimensions set to ${this.canvas.width}x${this.canvas.height}`);

            // Update WebGL viewport
            if (this.renderer) {
                this.renderer.handleResize();
            }
        }
    }

    /**
     * Handle key down events
     */
    handleKeyDown(key, event) {
        switch (key) {
            case 'Escape':
                if (this.isFullscreen()) {
                    this.exitFullscreen();
                }
                break;
            case 'f':
            case 'F':
                this.toggleFullscreen();
                break;
            case 'p':
            case 'P':
                this.togglePause();
                break;
            case 'i':
            case 'I':
                this.toggleInfo();
                break;
            case 's':
            case 'S':
                this.toggleStats();
                break;
            case 'r':
            case 'R':
                this.resetParameters();
                break;
        }
    }

    /**
     * Handle gamepad button events
     */
    handleGamepadButton(gamepadIndex, buttonIndex, value) {
        if (value > 0.5) { // Button pressed
            switch (buttonIndex) {
                case 0: // A button
                    this.sceneManager.nextScene();
                    break;
                case 1: // B button
                    this.sceneManager.previousScene();
                    break;
                case 2: // X button
                    this.toggleInfo();
                    break;
                case 3: // Y button
                    this.toggleStats();
                    break;
            }
        }
    }

    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen() {
        if (!this.isFullscreen()) {
            this.enterFullscreen();
        } else {
            this.exitFullscreen();
        }
    }

    /**
     * Enter fullscreen mode
     */
    enterFullscreen() {
        if (this.canvas.requestFullscreen) {
            this.canvas.requestFullscreen();
        } else if (this.canvas.webkitRequestFullscreen) {
            this.canvas.webkitRequestFullscreen();
        } else if (this.canvas.msRequestFullscreen) {
            this.canvas.msRequestFullscreen();
        }
    }

    /**
     * Exit fullscreen mode
     */
    exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }

    /**
     * Check if in fullscreen mode
     */
    isFullscreen() {
        return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    }

    /**
     * Toggle pause state
     */
    togglePause() {
        this.isPaused = !this.isPaused;
        console.log(this.isPaused ? '⏸️ Paused' : '▶️ Resumed');
    }

    /**
     * Reset parameters
     */
    resetParameters() {
        console.log('🔄 Resetting parameters');
        // Reset current scene if it has a reset method
        if (this.sceneManager.currentScene && this.sceneManager.currentScene.reset) {
            this.sceneManager.currentScene.reset();
        }
    }

    /**
     * Toggle info display
     */
    toggleInfo() {
        this.showInfo = !this.showInfo;
        const infoElement = document.getElementById('scene-info');
        if (infoElement) {
            infoElement.style.display = this.showInfo ? 'block' : 'none';
        }
    }

    /**
     * Toggle stats display
     */
    toggleStats() {
        this.showStats = !this.showStats;
        const statsElement = document.getElementById('stats');
        if (statsElement) {
            statsElement.style.display = this.showStats ? 'block' : 'none';
        }
    }

    /**
     * Update FPS counter
     */
    updateFPS(currentTime) {
        this.frameCount++;

        if (currentTime - this.fpsUpdateInterval >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsUpdateInterval = currentTime;
        }
    }

    /**
     * Get application statistics
     */
    getStats() {
        const sceneInfo = this.sceneManager.getCurrentSceneInfo();
        return {
            fps: this.fps,
            frameCount: this.frameCount,
            time: this.time,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            currentScene: sceneInfo ? sceneInfo.id : 'none',
            sceneProgress: sceneInfo ? sceneInfo.elapsed / sceneInfo.duration : 0
        };
    }

    /**
     * Clean up resources
     */
    dispose() {
        this.stop();

        if (this.sceneManager) {
            this.sceneManager.cleanup();
        }

        if (this.renderer) {
            this.renderer.dispose();
        }

        if (this.inputManager) {
            this.inputManager.dispose();
        }

        if (this.gamepadHandler) {
            this.gamepadHandler.dispose();
        }

        console.log('🧹 RUNNING ENTROPY application disposed');
    }
}

// Global application instance
let app = null;

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        app = new RunningEntropyApp();

        if (await app.initialize()) {
            app.start();
        } else {
            console.error('Failed to initialize application');
        }
    } catch (error) {
        console.error('Application startup error:', error);
        Utils.showError(`Startup error: ${error.message}`, 'Startup Error');
    }
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (app) {
        if (document.hidden) {
            app.isPaused = true;
        } else {
            app.isPaused = false;
        }
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RunningEntropyApp;
}

