/**
 * RUNNING ENTROPY - WebGL Renderer
 * Handles WebGL context, shaders, and rendering pipeline with dynamic shader support
 */

class WebGLRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;
        this.program = null;
        this.quadBuffer = null;
        this.quadVertexCount = 0;
        this.uniforms = {};
        this.isInitialized = false;
        this.frameCount = 0;
        this.startTime = 0;

        // Current shader sources
        this.currentVertexShader = null;
        this.currentFragmentShader = null;

        // Default shader sources
        this.defaultVertexShader = `
            attribute vec3 a_position;
            attribute vec2 a_uv;
            uniform mat4 u_modelViewProjection;
            varying vec2 v_uv;

            void main() {
                v_uv = a_uv;
                gl_Position = u_modelViewProjection * vec4(a_position, 1.0);
            }
        `;

        this.defaultFragmentShader = `
            precision highp float;
            varying vec2 v_uv;
            uniform float u_time;
            uniform float u_progress;
            uniform vec2 u_resolution;

            void main() {
                vec2 uv = v_uv;
                vec3 color = vec3(0.5 + 0.5 * sin(u_time), 0.5, 0.5);
                gl_FragColor = vec4(color, 1.0);
            }
        `;
    }

    /**
     * Initialize WebGL context and resources
     */
    initialize() {
        try {
            // Create WebGL context
            this.gl = Utils.createWebGLContext(this.canvas, {
                alpha: false,
                depth: false,
                stencil: false,
                antialias: true,
                premultipliedAlpha: false,
                preserveDrawingBuffer: false
            });

            if (!this.gl) {
                throw new Error('Failed to create WebGL context');
            }

            // Set up WebGL state
            this.gl.enable(this.gl.BLEND);
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
            this.gl.clearColor(0.0, 0.0, 0.0, 1.0);

            // Set initial viewport
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

            // Create full-screen quad
            this.createQuad();

            // Create default shader program
            this.updateShaders(this.defaultVertexShader, this.defaultFragmentShader);

            this.isInitialized = true;
            this.startTime = performance.now();

            console.log('🎨 WebGL renderer initialized successfully');
            return true;

        } catch (error) {
            console.error('Failed to initialize WebGL renderer:', error);
            return false;
        }
    }

    /**
     * Create full-screen quad geometry
     */
    createQuad() {
        const vertices = new Float32Array([
            // Position (x, y, z), UV (u, v)
            -1.0, -1.0, 0.0,  0.0, 0.0,
             1.0, -1.0, 0.0,  1.0, 0.0,
             1.0,  1.0, 0.0,  1.0, 1.0,
            -1.0,  1.0, 0.0,  0.0, 1.0
        ]);

        const indices = new Uint16Array([
            0, 1, 2,
            0, 2, 3
        ]);

        // Create vertex buffer
        this.quadBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

        // Create index buffer
        this.indexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.STATIC_DRAW);

        this.quadVertexCount = indices.length;
    }

    /**
     * Update shaders with new sources
     * @param {string} vertexShaderSource - Vertex shader source
     * @param {string} fragmentShaderSource - Fragment shader source
     */
    updateShaders(vertexShaderSource, fragmentShaderSource) {
        // Check if shaders have changed
        if (this.currentVertexShader === vertexShaderSource &&
            this.currentFragmentShader === fragmentShaderSource) {
            return; // No change needed
        }

        // Clean up old program
        if (this.program) {
            this.gl.deleteProgram(this.program);
        }

        // Create new shader program
        this.program = this.createShaderProgram(vertexShaderSource, fragmentShaderSource);

        if (!this.program) {
            console.error('Failed to create shader program');
            return;
        }

        // Update current shader sources
        this.currentVertexShader = vertexShaderSource;
        this.currentFragmentShader = fragmentShaderSource;

        // Get uniform locations
        this.uniformLocations = {};
        this.getUniformLocations();

        console.log('🎨 Shaders updated successfully');
    }

    /**
     * Create shader program from sources
     * @param {string} vertexSource - Vertex shader source
     * @param {string} fragmentSource - Fragment shader source
     * @returns {WebGLProgram} Shader program
     */
    createShaderProgram(vertexSource, fragmentSource) {
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource);

        if (!vertexShader || !fragmentShader) {
            return null;
        }

        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Failed to link shader program:', this.gl.getProgramInfoLog(program));
            this.gl.deleteProgram(program);
            return null;
        }

        // Clean up shaders
        this.gl.deleteShader(vertexShader);
        this.gl.deleteShader(fragmentShader);

        return program;
    }

    /**
     * Create shader from source
     * @param {number} type - Shader type
     * @param {string} source - Shader source
     * @returns {WebGLShader} Shader object
     */
    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Failed to compile shader:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    /**
     * Get uniform locations for current shader program
     */
    getUniformLocations() {
        if (!this.program) return;

        // Common uniforms
        const commonUniforms = [
            'u_time', 'u_progress', 'u_resolution', 'u_modelViewProjection'
        ];

        commonUniforms.forEach(name => {
            this.uniformLocations[name] = this.gl.getUniformLocation(this.program, name);
        });

        // Scene-specific uniforms (arrays and complex types)
        this.getArrayUniformLocations();
    }

    /**
     * Get array uniform locations
     */
    getArrayUniformLocations() {
        // Common array uniforms used across scenes
        const arrayUniforms = [
            'u_attractor_positions', 'u_attractor_lives', 'u_builtin_positions',
            'u_particle_data', 'u_trail_data', 'u_color_palette'
        ];

        arrayUniforms.forEach(name => {
            this.uniformLocations[name] = this.gl.getUniformLocation(this.program, name);
        });
    }

    /**
     * Set uniforms for rendering
     * @param {Object} uniforms - Uniform values
     */
    setUniforms(uniforms) {
        if (!this.program) return;

        this.gl.useProgram(this.program);

        // Set common uniforms
        if (uniforms.u_time !== undefined) {
            this.gl.uniform1f(this.uniformLocations.u_time, uniforms.u_time);
        }

        if (uniforms.u_progress !== undefined) {
            this.gl.uniform1f(this.uniformLocations.u_progress, uniforms.u_progress);
        }

        if (uniforms.u_resolution !== undefined) {
            this.gl.uniform2f(this.uniformLocations.u_resolution, uniforms.u_resolution[0], uniforms.u_resolution[1]);
        }

        // Set model-view-projection matrix
        const mvp = this.getModelViewProjectionMatrix();
        this.gl.uniformMatrix4fv(this.uniformLocations.u_modelViewProjection, false, mvp);

        // Set array uniforms
        this.setArrayUniforms(uniforms);
    }

    /**
     * Set array uniforms
     * @param {Object} uniforms - Uniform values
     */
    setArrayUniforms(uniforms) {
        // Attractor positions
        if (uniforms.u_attractor_positions) {
            this.gl.uniform2fv(this.uniformLocations.u_attractor_positions, uniforms.u_attractor_positions);
        }

        // Attractor lives
        if (uniforms.u_attractor_lives) {
            this.gl.uniform1fv(this.uniformLocations.u_attractor_lives, uniforms.u_attractor_lives);
        }

        // Built-in positions
        if (uniforms.u_builtin_positions) {
            this.gl.uniform2fv(this.uniformLocations.u_builtin_positions, uniforms.u_builtin_positions);
        }

        // Particle data
        if (uniforms.u_particle_data) {
            this.gl.uniform1fv(this.uniformLocations.u_particle_data, uniforms.u_particle_data);
        }

        // Trail data
        if (uniforms.u_trail_data) {
            this.gl.uniform1fv(this.uniformLocations.u_trail_data, uniforms.u_trail_data);
        }

        // Color palette
        if (uniforms.u_color_palette) {
            this.gl.uniform1fv(this.uniformLocations.u_color_palette, uniforms.u_color_palette);
        }

        // Scene-specific uniforms
        this.setSceneSpecificUniforms(uniforms);
    }

    /**
     * Set scene-specific uniforms
     * @param {Object} uniforms - Uniform values
     */
    setSceneSpecificUniforms(uniforms) {
        // Entropy Magma Scene uniforms
        if (uniforms.u_drag_start) {
            this.gl.uniform2f(this.uniformLocations.u_drag_start, uniforms.u_drag_start[0], uniforms.u_drag_start[1]);
        }

        if (uniforms.u_drag_current) {
            this.gl.uniform2f(this.uniformLocations.u_drag_current, uniforms.u_drag_current[0], uniforms.u_drag_current[1]);
        }

        if (uniforms.u_is_dragging !== undefined) {
            this.gl.uniform1f(this.uniformLocations.u_is_dragging, uniforms.u_is_dragging);
        }

        // Geometric Entropy Scene uniforms
        if (uniforms.u_geometry_type !== undefined) {
            this.gl.uniform1i(this.uniformLocations.u_geometry_type, uniforms.u_geometry_type);
        }

        if (uniforms.u_geometry_params) {
            this.gl.uniform4f(
                this.uniformLocations.u_geometry_params,
                uniforms.u_geometry_params[0],
                uniforms.u_geometry_params[1],
                uniforms.u_geometry_params[2],
                uniforms.u_geometry_params[3]
            );
        }

        if (uniforms.u_morphing_factor !== undefined) {
            this.gl.uniform1f(this.uniformLocations.u_morphing_factor, uniforms.u_morphing_factor);
        }

        // Particle Entropy Scene uniforms
        if (uniforms.u_particle_count !== undefined) {
            this.gl.uniform1i(this.uniformLocations.u_particle_count, uniforms.u_particle_count);
        }

        if (uniforms.u_max_particles !== undefined) {
            this.gl.uniform1i(this.uniformLocations.u_max_particles, uniforms.u_max_particles);
        }

        if (uniforms.u_trail_length !== undefined) {
            this.gl.uniform1i(this.uniformLocations.u_trail_length, uniforms.u_trail_length);
        }

        if (uniforms.u_gravity) {
            this.gl.uniform2f(this.uniformLocations.u_gravity, uniforms.u_gravity[0], uniforms.u_gravity[1]);
        }

        if (uniforms.u_wind) {
            this.gl.uniform2f(this.uniformLocations.u_wind, uniforms.u_wind[0], uniforms.u_wind[1]);
        }

        if (uniforms.u_turbulence !== undefined) {
            this.gl.uniform1f(this.uniformLocations.u_turbulence, uniforms.u_turbulence);
        }

        if (uniforms.u_particle_size !== undefined) {
            this.gl.uniform1f(this.uniformLocations.u_particle_size, uniforms.u_particle_size);
        }

        if (uniforms.u_bloom_intensity !== undefined) {
            this.gl.uniform1f(this.uniformLocations.u_bloom_intensity, uniforms.u_bloom_intensity);
        }
    }

    /**
     * Get model-view-projection matrix
     * @returns {Float32Array} MVP matrix
     */
    getModelViewProjectionMatrix() {
        // Simple orthographic projection for 2D rendering
        const left = -1.0;
        const right = 1.0;
        const bottom = -1.0;
        const top = 1.0;
        const near = -1.0;
        const far = 1.0;

        const width = right - left;
        const height = top - bottom;
        const depth = far - near;

        return new Float32Array([
            2.0 / width, 0.0, 0.0, 0.0,
            0.0, 2.0 / height, 0.0, 0.0,
            0.0, 0.0, -2.0 / depth, 0.0,
            -(right + left) / width, -(top + bottom) / height, -(far + near) / depth, 1.0
        ]);
    }

    /**
     * Render a frame
     */
    render() {
        if (!this.isInitialized || !this.program) return;

        // Clear screen
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        // Bind buffers
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

        // Set up vertex attributes
        const stride = 5 * 4; // 5 floats * 4 bytes
        const positionOffset = 0;
        const uvOffset = 3 * 4; // 3 floats * 4 bytes

        // Position attribute
        const positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
        this.gl.enableVertexAttribArray(positionLocation);
        this.gl.vertexAttribPointer(positionLocation, 3, this.gl.FLOAT, false, stride, positionOffset);

        // UV attribute
        const uvLocation = this.gl.getAttribLocation(this.program, 'a_uv');
        this.gl.enableVertexAttribArray(uvLocation);
        this.gl.vertexAttribPointer(uvLocation, 2, this.gl.FLOAT, false, stride, uvOffset);

        // Draw
        this.gl.drawElements(this.gl.TRIANGLES, this.quadVertexCount, this.gl.UNSIGNED_SHORT, 0);

        this.frameCount++;
    }

    /**
     * Handle window resize
     */
    handleResize() {
        if (!this.canvas || !this.gl) return;

        // Get the actual canvas dimensions
        const displayWidth = this.canvas.width;
        const displayHeight = this.canvas.height;

        // Set the viewport to match the canvas size
        this.gl.viewport(0, 0, displayWidth, displayHeight);

        console.log(`🎨 WebGL viewport set to ${displayWidth}x${displayHeight}`);
    }

    /**
     * Get frame count
     */
    getFrameCount() {
        return this.frameCount;
    }

    /**
     * Get renderer statistics
     */
    getStats() {
        return {
            frameCount: this.frameCount,
            isInitialized: this.isInitialized,
            canvasWidth: this.canvas ? this.canvas.width : 0,
            canvasHeight: this.canvas ? this.canvas.height : 0
        };
    }

    /**
     * Clean up resources
     */
    dispose() {
        if (this.program) {
            this.gl.deleteProgram(this.program);
            this.program = null;
        }

        if (this.quadBuffer) {
            this.gl.deleteBuffer(this.quadBuffer);
            this.quadBuffer = null;
        }

        if (this.indexBuffer) {
            this.gl.deleteBuffer(this.indexBuffer);
            this.indexBuffer = null;
        }

        console.log('🧹 WebGL renderer disposed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebGLRenderer;
}
