/**
 * Base Scene Class for RUNNING ENTROPY
 * All demoscene scenes inherit from this class
 */

class Scene {
    constructor(name, duration = 120000) { // Default 2 minutes
        this.name = name;
        this.duration = duration;
        this.startTime = 0;
        this.isInitialized = false;
        this.isActive = false;

        // Scene state
        this.time = 0;
        this.progress = 0; // 0.0 to 1.0

        // Input state (shared across scenes)
        this.inputState = {
            mouse: { x: 0, y: 0, pressed: false },
            touch: { x: 0, y: 0, pressed: false },
            keys: new Set(),
            gamepad: null
        };

        console.log(`🎬 Scene "${name}" constructed with duration: ${duration}ms`);
    }

    /**
     * Initialize the scene
     * Override this method in subclasses
     */
    initialize() {
        this.startTime = performance.now();
        this.isInitialized = true;
        this.isActive = true;
        this.time = 0;
        this.progress = 0;

        console.log(`🎭 Scene "${this.name}" initialized`);
    }

    /**
     * Update the scene
     * @param {number} deltaTime - Time since last update in milliseconds
     * @param {number} currentTime - Current time in milliseconds
     */
    update(deltaTime, currentTime) {
        if (!this.isActive) return;

        // Update scene time and progress
        this.time = (currentTime - this.startTime) * 0.001; // Convert to seconds
        this.progress = Math.min(this.time / (this.duration * 0.001), 1.0);

        // Call subclass update method
        this.onUpdate(deltaTime, currentTime);
    }

    /**
     * Render the scene
     * @param {WebGLRenderer} renderer - WebGL renderer instance
     */
    render(renderer) {
        if (!this.isActive) return;

        // Call subclass render method
        this.onRender(renderer);
    }

    /**
     * Clean up scene resources
     */
    cleanup() {
        this.isActive = false;
        this.isInitialized = false;

        // Call subclass cleanup method
        this.onCleanup();

        console.log(`🧹 Scene "${this.name}" cleaned up`);
    }

    /**
     * Get scene duration in milliseconds
     */
    getDuration() {
        return this.duration;
    }

    /**
     * Set input state (called by main app)
     * @param {Object} inputState - Current input state
     */
    setInputState(inputState) {
        this.inputState = inputState;
    }

    /**
     * Get scene information for UI
     */
    getInfo() {
        return {
            name: this.name,
            duration: this.duration,
            progress: this.progress,
            time: this.time,
            isActive: this.isActive
        };
    }

    // Abstract methods to be implemented by subclasses

    /**
     * Scene-specific update logic
     * @param {number} deltaTime - Time since last update
     * @param {number} currentTime - Current time
     */
    onUpdate(deltaTime, currentTime) {
        // Override in subclasses
    }

    /**
     * Scene-specific render logic
     * @param {WebGLRenderer} renderer - WebGL renderer
     */
    onRender(renderer) {
        // Override in subclasses
    }

    /**
     * Scene-specific cleanup logic
     */
    onCleanup() {
        // Override in subclasses
    }

    /**
     * Get shader uniforms for this scene
     * @returns {Object} Uniforms object
     */
    getUniforms() {
        return {
            u_time: this.time,
            u_progress: this.progress,
            u_scene_name: this.name
        };
    }

    /**
     * Get fragment shader source for this scene
     * @returns {string} GLSL shader source
     */
    getFragmentShader() {
        // Default shader - override in subclasses
        return `
            precision highp float;

            uniform float u_time;
            uniform float u_progress;
            uniform vec2 u_resolution;

            varying vec2 v_uv;

            void main() {
                vec2 uv = v_uv;
                vec3 color = vec3(0.5 + 0.5 * sin(u_time), 0.5, 0.5);
                gl_FragColor = vec4(color, 1.0);
            }
        `;
    }

    /**
     * Get vertex shader source for this scene
     * @returns {string} GLSL shader source
     */
    getVertexShader() {
        return `
            attribute vec3 a_position;
            attribute vec2 a_uv;

            uniform mat4 u_modelViewProjection;

            varying vec2 v_uv;

            void main() {
                v_uv = a_uv;
                gl_Position = u_modelViewProjection * vec4(a_position, 1.0);
            }
        `;
    }
}
