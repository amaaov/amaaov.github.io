/**
 * RUNNING ENTROPY - Noise Generator
 * Manages noise algorithms and parameters
 */

class NoiseGenerator {
    constructor() {
        this.isInitialized = false;

        // Noise parameters
        this.parameters = {
            scale: 100.0,
            speed: 1.0,
            intensity: 1.0,
            type: 0.0, // 0=white, 0.25=smooth, 0.5=fractal, 0.75=cellular
            seed: Math.random(),
            octaves: 4,
            persistence: 0.5,
            lacunarity: 2.0
        };

        // Noise types
        this.noiseTypes = {
            WHITE: 0.0,
            SMOOTH: 0.25,
            FRACTAL: 0.5,
            CELLULAR: 0.75
        };

        // Animation state
        this.time = 0;
        this.lastUpdate = 0;

        // Parameter limits
        this.limits = {
            scale: { min: 10, max: 500 },
            speed: { min: 0, max: 5 },
            intensity: { min: 0, max: 2 },
            type: { min: 0, max: 1 },
            octaves: { min: 1, max: 8 },
            persistence: { min: 0.1, max: 1.0 },
            lacunarity: { min: 1.0, max: 4.0 }
        };

        // Preset configurations
        this.presets = {
            calm: {
                scale: 50,
                speed: 0.2,
                intensity: 0.8,
                type: this.noiseTypes.SMOOTH,
                octaves: 3,
                persistence: 0.6,
                lacunarity: 1.8
            },
            turbulent: {
                scale: 200,
                speed: 2.0,
                intensity: 1.5,
                type: this.noiseTypes.FRACTAL,
                octaves: 6,
                persistence: 0.4,
                lacunarity: 2.5
            },
            chaotic: {
                scale: 300,
                speed: 3.0,
                intensity: 1.8,
                type: this.noiseTypes.CELLULAR,
                octaves: 8,
                persistence: 0.3,
                lacunarity: 3.0
            },
            static: {
                scale: 150,
                speed: 0,
                intensity: 1.2,
                type: this.noiseTypes.WHITE,
                octaves: 1,
                persistence: 0.5,
                lacunarity: 2.0
            }
        };
    }

    /**
     * Initialize the noise generator
     */
    initialize() {
        try {
            this.time = 0;
            this.lastUpdate = Utils.getTimestamp();
            this.isInitialized = true;

            console.log('Noise generator initialized successfully');
            return true;

        } catch (error) {
            console.error('Failed to initialize noise generator:', error);
            return false;
        }
    }

    /**
     * Update noise generator
     * @param {number} deltaTime - Time since last update in milliseconds
     */
    update(deltaTime) {
        if (!this.isInitialized) return;

        this.time += deltaTime * this.parameters.speed * 0.001;
        this.lastUpdate = Utils.getTimestamp();
    }

    /**
     * Set noise parameter
     * @param {string} name - Parameter name
     * @param {number} value - Parameter value
     */
    setParameter(name, value) {
        if (this.parameters.hasOwnProperty(name)) {
            const limit = this.limits[name];
            if (limit) {
                this.parameters[name] = Utils.clamp(value, limit.min, limit.max);
            } else {
                this.parameters[name] = value;
            }
        }
    }

    /**
     * Set multiple parameters at once
     * @param {Object} params - Parameters object
     */
    setParameters(params) {
        for (const [name, value] of Object.entries(params)) {
            this.setParameter(name, value);
        }
    }

    /**
     * Get noise parameter
     * @param {string} name - Parameter name
     * @returns {number} Parameter value
     */
    getParameter(name) {
        return this.parameters[name] || 0;
    }

    /**
     * Get all parameters
     * @returns {Object} All parameters
     */
    getParameters() {
        return { ...this.parameters };
    }

    /**
     * Load preset configuration
     * @param {string} presetName - Preset name
     */
    loadPreset(presetName) {
        const preset = this.presets[presetName];
        if (preset) {
            this.setParameters(preset);
            console.log(`Loaded preset: ${presetName}`);
        } else {
            console.warn(`Preset not found: ${presetName}`);
        }
    }

    /**
     * Save current configuration as preset
     * @param {string} presetName - Preset name
     */
    savePreset(presetName) {
        this.presets[presetName] = { ...this.parameters };
        console.log(`Saved preset: ${presetName}`);
    }

    /**
     * Get available presets
     * @returns {Array} Array of preset names
     */
    getAvailablePresets() {
        return Object.keys(this.presets);
    }

    /**
     * Reset parameters to defaults
     */
    resetParameters() {
        this.parameters = {
            scale: 100.0,
            speed: 1.0,
            intensity: 1.0,
            type: 0.0,
            seed: Math.random(),
            octaves: 4,
            persistence: 0.5,
            lacunarity: 2.0
        };
        console.log('Parameters reset to defaults');
    }

    /**
     * Generate random seed
     */
    randomizeSeed() {
        this.parameters.seed = Math.random();
        console.log('Seed randomized');
    }

    /**
     * Set noise type
     * @param {string} type - Noise type name
     */
    setNoiseType(type) {
        const typeValue = this.noiseTypes[type.toUpperCase()];
        if (typeValue !== undefined) {
            this.parameters.type = typeValue;
            console.log(`Noise type set to: ${type}`);
        } else {
            console.warn(`Unknown noise type: ${type}`);
        }
    }

    /**
     * Get current noise type name
     * @returns {string} Noise type name
     */
    getNoiseTypeName() {
        for (const [name, value] of Object.entries(this.noiseTypes)) {
            if (Math.abs(this.parameters.type - value) < 0.01) {
                return name.toLowerCase();
            }
        }
        return 'unknown';
    }

    /**
     * Get available noise types
     * @returns {Array} Array of noise type names
     */
    getAvailableNoiseTypes() {
        return Object.keys(this.noiseTypes).map(key => key.toLowerCase());
    }

    /**
     * Apply input influence to parameters
     * @param {Object} input - Input state
     */
    applyInput(input) {
        // Mouse/touch influence
        if (input.input && input.input.isActive) {
            const x = input.input.x;
            const y = input.input.y;

            // Map position to parameters
            this.setParameter('scale', Utils.map(x, 0, 1, this.limits.scale.min, this.limits.scale.max));
            this.setParameter('intensity', Utils.map(y, 0, 1, this.limits.intensity.min, this.limits.intensity.max));
        }

        // Gamepad influence
        if (input.gamepad) {
            const gamepad = input.gamepad;

            // Left stick controls scale and speed
            if (gamepad.leftStick) {
                const leftX = gamepad.leftStick.x;
                const leftY = gamepad.leftStick.y;

                if (Math.abs(leftX) > 0.1) {
                    const currentScale = this.getParameter('scale');
                    const scaleDelta = leftX * 10;
                    this.setParameter('scale', currentScale + scaleDelta);
                }

                if (Math.abs(leftY) > 0.1) {
                    const currentSpeed = this.getParameter('speed');
                    const speedDelta = leftY * 0.5;
                    this.setParameter('speed', currentSpeed + speedDelta);
                }
            }

            // Right stick controls type and octaves
            if (gamepad.rightStick) {
                const rightX = gamepad.rightStick.x;
                const rightY = gamepad.rightStick.y;

                if (Math.abs(rightX) > 0.1) {
                    const currentType = this.getParameter('type');
                    const typeDelta = rightX * 0.1;
                    this.setParameter('type', currentType + typeDelta);
                }

                if (Math.abs(rightY) > 0.1) {
                    const currentOctaves = this.getParameter('octaves');
                    const octaveDelta = Math.round(rightY);
                    this.setParameter('octaves', currentOctaves + octaveDelta);
                }
            }

            // Triggers control intensity
            if (gamepad.triggers) {
                const leftTrigger = gamepad.triggers.left;
                const rightTrigger = gamepad.triggers.right;

                if (leftTrigger > 0.1) {
                    const currentIntensity = this.getParameter('intensity');
                    const intensityDelta = leftTrigger * 0.1;
                    this.setParameter('intensity', currentIntensity + intensityDelta);
                }

                if (rightTrigger > 0.1) {
                    const currentIntensity = this.getParameter('intensity');
                    const intensityDelta = -rightTrigger * 0.1;
                    this.setParameter('intensity', currentIntensity + intensityDelta);
                }
            }

            // Buttons for quick actions
            if (gamepad.buttons) {
                if (gamepad.buttons.A) {
                    this.randomizeSeed();
                }

                if (gamepad.buttons.B) {
                    this.resetParameters();
                }

                if (gamepad.buttons.X) {
                    this.loadPreset('calm');
                }

                if (gamepad.buttons.Y) {
                    this.loadPreset('turbulent');
                }
            }
        }
    }

    /**
     * Get parameters for WebGL shader
     * @returns {Object} Parameters for shader uniforms
     */
    getShaderParameters() {
        return {
            noiseScale: this.parameters.scale,
            noiseSpeed: this.parameters.speed,
            noiseIntensity: this.parameters.intensity,
            noiseType: this.parameters.type,
            seed: this.parameters.seed,
            time: this.time
        };
    }

    /**
     * Get noise statistics
     * @returns {Object} Noise statistics
     */
    getStats() {
        return {
            isInitialized: this.isInitialized,
            time: this.time,
            parameters: this.getParameters(),
            noiseType: this.getNoiseTypeName(),
            availablePresets: this.getAvailablePresets(),
            availableTypes: this.getAvailableNoiseTypes()
        };
    }

    /**
     * Export configuration
     * @returns {Object} Configuration object
     */
    exportConfig() {
        return {
            parameters: this.getParameters(),
            presets: this.presets,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Import configuration
     * @param {Object} config - Configuration object
     */
    importConfig(config) {
        if (config.parameters) {
            this.setParameters(config.parameters);
        }

        if (config.presets) {
            this.presets = { ...this.presets, ...config.presets };
        }

        console.log('Configuration imported');
    }

    /**
     * Create a deep copy of the noise generator
     * @returns {NoiseGenerator} New noise generator instance
     */
    clone() {
        const clone = new NoiseGenerator();
        clone.setParameters(this.getParameters());
        clone.presets = { ...this.presets };
        clone.time = this.time;
        return clone;
    }

    /**
     * Clean up resources
     */
    dispose() {
        this.isInitialized = false;
        console.log('Noise generator disposed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NoiseGenerator;
}
