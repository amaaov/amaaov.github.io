/**
 * RUNNING ENTROPY - Utility Functions
 * Common utilities and helper functions for the application
 */

class Utils {
    /**
     * Clamp a value between min and max
     * @param {number} value - The value to clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Clamped value
     */
    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    /**
     * Linear interpolation between two values
     * @param {number} a - Start value
     * @param {number} b - End value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number} Interpolated value
     */
    static lerp(a, b, t) {
        return a + (b - a) * t;
    }

    /**
     * Smooth interpolation using smoothstep
     * @param {number} a - Start value
     * @param {number} b - End value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number} Smoothly interpolated value
     */
    static smoothLerp(a, b, t) {
        const smoothT = t * t * (3 - 2 * t);
        return a + (b - a) * smoothT;
    }

    /**
     * Map a value from one range to another
     * @param {number} value - Input value
     * @param {number} inMin - Input minimum
     * @param {number} inMax - Input maximum
     * @param {number} outMin - Output minimum
     * @param {number} outMax - Output maximum
     * @returns {number} Mapped value
     */
    static map(value, inMin, inMax, outMin, outMax) {
        return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
    }

    /**
     * Generate a random float between min and max
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random float
     */
    static randomFloat(min, max) {
        return Math.random() * (max - min) + min;
    }

    /**
     * Generate a random integer between min and max (inclusive)
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random integer
     */
    static randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Generate a seeded random number
     * @param {number} seed - Seed value
     * @returns {number} Seeded random number
     */
    static seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    /**
     * Calculate distance between two 2D points
     * @param {number} x1 - First point x
     * @param {number} y1 - First point y
     * @param {number} x2 - Second point x
     * @param {number} y2 - Second point y
     * @returns {number} Distance
     */
    static distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Calculate angle between two 2D points
     * @param {number} x1 - First point x
     * @param {number} y1 - First point y
     * @param {number} x2 - Second point x
     * @param {number} y2 - Second point y
     * @returns {number} Angle in radians
     */
    static angle(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    }

    /**
     * Convert degrees to radians
     * @param {number} degrees - Angle in degrees
     * @returns {number} Angle in radians
     */
    static toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Convert radians to degrees
     * @param {number} radians - Angle in radians
     * @returns {number} Angle in degrees
     */
    static toDegrees(radians) {
        return radians * (180 / Math.PI);
    }

    /**
     * Get current timestamp in milliseconds
     * @returns {number} Current timestamp
     */
    static getTimestamp() {
        return performance.now();
    }

    /**
     * Format time in seconds to MM:SS format
     * @param {number} seconds - Time in seconds
     * @returns {string} Formatted time string
     */
    static formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Format file size in bytes to human readable format
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted size string
     */
    static formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Debounce function execution
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle function execution
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in milliseconds
     * @returns {Function} Throttled function
     */
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Check if WebGL is supported
     * @returns {boolean} True if WebGL is supported
     */
    static isWebGLSupported() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext &&
                     (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }

    /**
     * Check if WebGL2 is supported
     * @returns {boolean} True if WebGL2 is supported
     */
    static isWebGL2Supported() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
        } catch (e) {
            return false;
        }
    }

    /**
     * Check if Gamepad API is supported
     * @returns {boolean} True if Gamepad API is supported
     */
    static isGamepadSupported() {
        return 'getGamepads' in navigator;
    }

    /**
     * Check if device is mobile
     * @returns {boolean} True if mobile device
     */
    static isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    /**
     * Check if device supports touch
     * @returns {boolean} True if touch is supported
     */
    static isTouchSupported() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    /**
     * Get device pixel ratio
     * @returns {number} Device pixel ratio
     */
    static getDevicePixelRatio() {
        return window.devicePixelRatio || 1;
    }

    /**
     * Get viewport dimensions
     * @returns {Object} Viewport width and height
     */
    static getViewportSize() {
        return {
            width: window.innerWidth,
            height: window.innerHeight
        };
    }

    /**
     * Get canvas size accounting for device pixel ratio
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @returns {Object} Canvas display and actual size
     */
    static getCanvasSize(canvas) {
        const rect = canvas.getBoundingClientRect();
        const pixelRatio = this.getDevicePixelRatio();

        return {
            displayWidth: rect.width,
            displayHeight: rect.height,
            actualWidth: rect.width * pixelRatio,
            actualHeight: rect.height * pixelRatio
        };
    }

    /**
     * Resize canvas for high DPI displays
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {number} width - Display width
     * @param {number} height - Display height
     */
    static resizeCanvas(canvas, width, height) {
        const pixelRatio = this.getDevicePixelRatio();

        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        canvas.width = width * pixelRatio;
        canvas.height = height * pixelRatio;

        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (gl) {
            gl.viewport(0, 0, canvas.width, canvas.height);
        }
    }

    /**
     * Create a WebGL context
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {Object} options - WebGL context options
     * @returns {WebGLRenderingContext|WebGL2RenderingContext} WebGL context
     */
    static createWebGLContext(canvas, options = {}) {
        const defaultOptions = {
            alpha: false,
            antialias: false,
            depth: false,
            stencil: false,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance'
        };

        const contextOptions = { ...defaultOptions, ...options };

        // Try WebGL2 first, fallback to WebGL1
        let gl = canvas.getContext('webgl2', contextOptions);
        if (!gl) {
            gl = canvas.getContext('webgl', contextOptions) ||
                 canvas.getContext('experimental-webgl', contextOptions);
        }

        return gl;
    }

    /**
     * Compile WebGL shader
     * @param {WebGLRenderingContext|WebGL2RenderingContext} gl - WebGL context
     * @param {number} type - Shader type (VERTEX_SHADER or FRAGMENT_SHADER)
     * @param {string} source - Shader source code
     * @returns {WebGLShader} Compiled shader
     */
    static compileShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Shader compilation error: ${error}`);
        }

        return shader;
    }

    /**
     * Create WebGL program from vertex and fragment shaders
     * @param {WebGLRenderingContext|WebGL2RenderingContext} gl - WebGL context
     * @param {WebGLShader} vertexShader - Vertex shader
     * @param {WebGLShader} fragmentShader - Fragment shader
     * @returns {WebGLProgram} WebGL program
     */
    static createProgram(gl, vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const error = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error(`Program linking error: ${error}`);
        }

        return program;
    }

    /**
     * Create a full-screen quad for rendering
     * @param {WebGLRenderingContext|WebGL2RenderingContext} gl - WebGL context
     * @returns {Object} Buffer and attribute location
     */
    static createFullScreenQuad(gl) {
        const vertices = new Float32Array([
            -1, -1, 0, 0,
             1, -1, 1, 0,
            -1,  1, 0, 1,
             1,  1, 1, 1
        ]);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        return {
            buffer,
            vertexCount: 4
        };
    }

    /**
     * Show error message
     * @param {string} message - Error message
     * @param {string} title - Error title
     */
    static showError(message, title = 'Error') {
        const errorModal = document.getElementById('error-modal');
        const errorMessage = document.getElementById('error-message');

        if (errorModal && errorMessage) {
            errorMessage.textContent = message;
            errorModal.classList.remove('hidden');
        } else {
            console.error(`${title}: ${message}`);
            alert(`${title}: ${message}`);
        }
    }

    /**
     * Hide error message
     */
    static hideError() {
        const errorModal = document.getElementById('error-modal');
        if (errorModal) {
            errorModal.classList.add('hidden');
        }
    }

    /**
     * Show loading screen
     */
    static showLoading() {
        const loadingScreen = document.getElementById('loading');
        if (loadingScreen) {
            loadingScreen.classList.remove('hidden');
        }
    }

    /**
     * Hide loading screen
     */
    static hideLoading() {
        const loadingScreen = document.getElementById('loading');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
        }
    }

    /**
     * Update status display
     * @param {string} type - Status type ('fps', 'resolution', 'gamepad')
     * @param {string} value - Status value
     */
    static updateStatus(type, value) {
        const elements = {
            fps: document.getElementById('fps-counter'),
            resolution: document.getElementById('resolution-display'),
            gamepad: document.getElementById('gamepad-status')
        };

        const element = elements[type];
        if (element) {
            element.textContent = value;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
