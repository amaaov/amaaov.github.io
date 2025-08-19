/**
 * Geometric Entropy Scene
 * Abstract geometric patterns and mathematical visualizations
 *
 * DEVELOPMENT MODE:
 * To test this scene in isolation, use:
 *   sceneManager.enableDevelopmentMode('geometric_entropy');
 *
 * To disable development mode:
 *   sceneManager.disableDevelopmentMode();
 *
 * Or press 'D' key to toggle development mode for current scene
 */

class GeometricEntropyScene extends Scene {
    constructor() {
        super("Geometric Entropy", 150000); // 2.5 minutes

        // Geometric parameters
        this.geometryType = 'voronoi'; // voronoi, delaunay, fractals, tessellation
        this.geometryParams = {
            scale: 1.0,
            rotation: 0.0,
            distortion: 0.0,
            complexity: 1.0
        };

        // Animation parameters
        this.animationSpeed = 0.5;
        this.morphingFactor = 0.0;

        // Color palette
        this.colorPalette = [
            [1.0, 0.2, 0.3], // Red
            [0.2, 0.8, 1.0], // Cyan
            [0.8, 0.2, 1.0], // Magenta
            [1.0, 0.8, 0.2], // Yellow
            [0.2, 1.0, 0.5]  // Green
        ];

        console.log('🔷 GeometricEntropyScene constructed - ready to tessellate reality');
    }

    onUpdate(deltaTime, currentTime) {
        const dt = deltaTime * 0.001;

        // Animate geometry parameters
        this.geometryParams.rotation += dt * 0.3;
        this.geometryParams.scale = 1.0 + 0.3 * Math.sin(this.time * 0.5);
        this.geometryParams.distortion = 0.5 * Math.sin(this.time * 0.7);
        this.geometryParams.complexity = 1.0 + 2.0 * this.progress;

        // Morph between different geometry types
        this.morphingFactor = (Math.sin(this.time * 0.2) + 1.0) * 0.5;

        // Cycle through geometry types
        const geometryTypes = ['voronoi', 'delaunay', 'fractals', 'tessellation'];
        const typeIndex = Math.floor(this.time * 0.1) % geometryTypes.length;
        this.geometryType = geometryTypes[typeIndex];
    }

    onRender(renderer) {
        const uniforms = {
            u_time: this.time,
            u_progress: this.progress,
            u_resolution: [renderer.canvas.width, renderer.canvas.height],
            u_geometry_type: this.getGeometryTypeIndex(),
            u_geometry_params: [
                this.geometryParams.scale,
                this.geometryParams.rotation,
                this.geometryParams.distortion,
                this.geometryParams.complexity
            ],
            u_morphing_factor: this.morphingFactor,
            u_animation_speed: this.animationSpeed,
            u_color_palette: new Float32Array(this.colorPalette.flat())
        };

        renderer.setUniforms(uniforms);
        renderer.render();
    }

    onCleanup() {
        // Clean up any scene-specific resources
    }

    getGeometryTypeIndex() {
        const types = ['voronoi', 'delaunay', 'fractals', 'tessellation'];
        return types.indexOf(this.geometryType);
    }

    getFragmentShader() {
        return `
            precision highp float;

            uniform float u_time;
            uniform float u_progress;
            uniform vec2 u_resolution;
            uniform int u_geometry_type;
            uniform vec4 u_geometry_params;
            uniform float u_morphing_factor;
            uniform float u_animation_speed;
            uniform float u_color_palette[15];

            varying vec2 v_uv;

            // Utility functions
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }

            vec2 hash2(vec2 p) {
                return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
            }

            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);

                float a = hash(i);
                float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0));
                float d = hash(i + vec2(1.0, 1.0));

                return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
            }

            float fbm(vec2 p) {
                float value = 0.0;
                float amplitude = 0.5;
                float frequency = 1.0;

                value += amplitude * noise(p * frequency);
                amplitude *= 0.5;
                frequency *= 2.0;

                value += amplitude * noise(p * frequency);
                amplitude *= 0.5;
                frequency *= 2.0;

                value += amplitude * noise(p * frequency);
                amplitude *= 0.5;
                frequency *= 2.0;

                value += amplitude * noise(p * frequency);
                amplitude *= 0.5;
                frequency *= 2.0;

                value += amplitude * noise(p * frequency);
                amplitude *= 0.5;
                frequency *= 2.0;

                value += amplitude * noise(p * frequency);

                return value;
            }

            // Voronoi cell function
            float voronoi(vec2 p) {
                vec2 n = floor(p);
                vec2 f = fract(p);

                float m = 8.0;

                // Unrolled 3x3 grid
                vec2 g00 = vec2(-1.0, -1.0);
                vec2 o00 = hash2(n + g00);
                o00 = 0.5 + 0.5 * sin(u_time + 6.2831 * o00);
                vec2 r00 = g00 + o00 - f;
                float d00 = dot(r00, r00);
                m = min(m, d00);

                vec2 g10 = vec2(0.0, -1.0);
                vec2 o10 = hash2(n + g10);
                o10 = 0.5 + 0.5 * sin(u_time + 6.2831 * o10);
                vec2 r10 = g10 + o10 - f;
                float d10 = dot(r10, r10);
                m = min(m, d10);

                vec2 g20 = vec2(1.0, -1.0);
                vec2 o20 = hash2(n + g20);
                o20 = 0.5 + 0.5 * sin(u_time + 6.2831 * o20);
                vec2 r20 = g20 + o20 - f;
                float d20 = dot(r20, r20);
                m = min(m, d20);

                vec2 g01 = vec2(-1.0, 0.0);
                vec2 o01 = hash2(n + g01);
                o01 = 0.5 + 0.5 * sin(u_time + 6.2831 * o01);
                vec2 r01 = g01 + o01 - f;
                float d01 = dot(r01, r01);
                m = min(m, d01);

                vec2 g11 = vec2(0.0, 0.0);
                vec2 o11 = hash2(n + g11);
                o11 = 0.5 + 0.5 * sin(u_time + 6.2831 * o11);
                vec2 r11 = g11 + o11 - f;
                float d11 = dot(r11, r11);
                m = min(m, d11);

                vec2 g21 = vec2(1.0, 0.0);
                vec2 o21 = hash2(n + g21);
                o21 = 0.5 + 0.5 * sin(u_time + 6.2831 * o21);
                vec2 r21 = g21 + o21 - f;
                float d21 = dot(r21, r21);
                m = min(m, d21);

                vec2 g02 = vec2(-1.0, 1.0);
                vec2 o02 = hash2(n + g02);
                o02 = 0.5 + 0.5 * sin(u_time + 6.2831 * o02);
                vec2 r02 = g02 + o02 - f;
                float d02 = dot(r02, r02);
                m = min(m, d02);

                vec2 g12 = vec2(0.0, 1.0);
                vec2 o12 = hash2(n + g12);
                o12 = 0.5 + 0.5 * sin(u_time + 6.2831 * o12);
                vec2 r12 = g12 + o12 - f;
                float d12 = dot(r12, r12);
                m = min(m, d12);

                vec2 g22 = vec2(1.0, 1.0);
                vec2 o22 = hash2(n + g22);
                o22 = 0.5 + 0.5 * sin(u_time + 6.2831 * o22);
                vec2 r22 = g22 + o22 - f;
                float d22 = dot(r22, r22);
                m = min(m, d22);

                return sqrt(m);
            }

            // Delaunay triangulation approximation
            float delaunay(vec2 p) {
                vec2 n = floor(p);
                vec2 f = fract(p);

                float m = 8.0;

                // Unrolled 5x5 grid (simplified to 3x3 for performance)
                vec2 g00 = vec2(-1.0, -1.0);
                vec2 o00 = hash2(n + g00);
                o00 = 0.5 + 0.5 * sin(u_time + 6.2831 * o00);
                vec2 r00 = g00 + o00 - f;
                float d00 = dot(r00, r00);
                m = min(m, d00);

                vec2 g10 = vec2(0.0, -1.0);
                vec2 o10 = hash2(n + g10);
                o10 = 0.5 + 0.5 * sin(u_time + 6.2831 * o10);
                vec2 r10 = g10 + o10 - f;
                float d10 = dot(r10, r10);
                m = min(m, d10);

                vec2 g20 = vec2(1.0, -1.0);
                vec2 o20 = hash2(n + g20);
                o20 = 0.5 + 0.5 * sin(u_time + 6.2831 * o20);
                vec2 r20 = g20 + o20 - f;
                float d20 = dot(r20, r20);
                m = min(m, d20);

                vec2 g01 = vec2(-1.0, 0.0);
                vec2 o01 = hash2(n + g01);
                o01 = 0.5 + 0.5 * sin(u_time + 6.2831 * o01);
                vec2 r01 = g01 + o01 - f;
                float d01 = dot(r01, r01);
                m = min(m, d01);

                vec2 g11 = vec2(0.0, 0.0);
                vec2 o11 = hash2(n + g11);
                o11 = 0.5 + 0.5 * sin(u_time + 6.2831 * o11);
                vec2 r11 = g11 + o11 - f;
                float d11 = dot(r11, r11);
                m = min(m, d11);

                vec2 g21 = vec2(1.0, 0.0);
                vec2 o21 = hash2(n + g21);
                o21 = 0.5 + 0.5 * sin(u_time + 6.2831 * o21);
                vec2 r21 = g21 + o21 - f;
                float d21 = dot(r21, r21);
                m = min(m, d21);

                vec2 g02 = vec2(-1.0, 1.0);
                vec2 o02 = hash2(n + g02);
                o02 = 0.5 + 0.5 * sin(u_time + 6.2831 * o02);
                vec2 r02 = g02 + o02 - f;
                float d02 = dot(r02, r02);
                m = min(m, d02);

                vec2 g12 = vec2(0.0, 1.0);
                vec2 o12 = hash2(n + g12);
                o12 = 0.5 + 0.5 * sin(u_time + 6.2831 * o12);
                vec2 r12 = g12 + o12 - f;
                float d12 = dot(r12, r12);
                m = min(m, d12);

                vec2 g22 = vec2(1.0, 1.0);
                vec2 o22 = hash2(n + g22);
                o22 = 0.5 + 0.5 * sin(u_time + 6.2831 * o22);
                vec2 r22 = g22 + o22 - f;
                float d22 = dot(r22, r22);
                m = min(m, d22);

                return sqrt(m);
            }

            // Fractal pattern
            float fractals(vec2 p) {
                float value = 0.0;
                float amplitude = 1.0;
                float frequency = 1.0;

                value += amplitude * abs(sin(p.x * frequency + u_time) * cos(p.y * frequency + u_time));
                amplitude *= 0.5;
                frequency *= 2.0;

                value += amplitude * abs(sin(p.x * frequency + u_time) * cos(p.y * frequency + u_time));
                amplitude *= 0.5;
                frequency *= 2.0;

                value += amplitude * abs(sin(p.x * frequency + u_time) * cos(p.y * frequency + u_time));
                amplitude *= 0.5;
                frequency *= 2.0;

                value += amplitude * abs(sin(p.x * frequency + u_time) * cos(p.y * frequency + u_time));
                amplitude *= 0.5;
                frequency *= 2.0;

                value += amplitude * abs(sin(p.x * frequency + u_time) * cos(p.y * frequency + u_time));
                amplitude *= 0.5;
                frequency *= 2.0;

                value += amplitude * abs(sin(p.x * frequency + u_time) * cos(p.y * frequency + u_time));
                amplitude *= 0.5;
                frequency *= 2.0;

                value += amplitude * abs(sin(p.x * frequency + u_time) * cos(p.y * frequency + u_time));
                amplitude *= 0.5;
                frequency *= 2.0;

                value += amplitude * abs(sin(p.x * frequency + u_time) * cos(p.y * frequency + u_time));

                return value;
            }

            // Tessellation pattern
            float tessellation(vec2 p) {
                vec2 q = p * 4.0;
                float t = u_time * 0.5;

                float value = 0.0;

                q = abs(q) - 1.0;
                q = mat2(cos(t), -sin(t), sin(t), cos(t)) * q;
                value += length(q) * 0.1;

                q = abs(q) - 1.0;
                q = mat2(cos(t), -sin(t), sin(t), cos(t)) * q;
                value += length(q) * 0.1;

                q = abs(q) - 1.0;
                q = mat2(cos(t), -sin(t), sin(t), cos(t)) * q;
                value += length(q) * 0.1;

                q = abs(q) - 1.0;
                q = mat2(cos(t), -sin(t), sin(t), cos(t)) * q;
                value += length(q) * 0.1;

                return value;
            }

            // Color palette function
            vec3 getColor(float t) {
                int index = int(mod(t * 5.0, 5.0));

                if (index == 0) {
                    return vec3(u_color_palette[0], u_color_palette[1], u_color_palette[2]);
                } else if (index == 1) {
                    return vec3(u_color_palette[3], u_color_palette[4], u_color_palette[5]);
                } else if (index == 2) {
                    return vec3(u_color_palette[6], u_color_palette[7], u_color_palette[8]);
                } else if (index == 3) {
                    return vec3(u_color_palette[9], u_color_palette[10], u_color_palette[11]);
                } else {
                    return vec3(u_color_palette[12], u_color_palette[13], u_color_palette[14]);
                }
            }

            void main() {
                vec2 uv = v_uv;

                // Apply geometric transformations
                float scale = u_geometry_params.x;
                float rotation = u_geometry_params.y;
                float distortion = u_geometry_params.z;
                float complexity = u_geometry_params.w;

                // Rotate and scale
                vec2 p = (uv - 0.5) * scale;
                float c = cos(rotation);
                float s = sin(rotation);
                p = mat2(c, -s, s, c) * p;
                p += 0.5;

                // Add distortion
                p += distortion * vec2(noise(p * 3.0 + u_time), noise(p * 3.0 + u_time + 1.0));

                // Calculate different geometry patterns
                float voronoi_val = voronoi(p * complexity);
                float delaunay_val = delaunay(p * complexity);
                float fractals_val = fractals(p * complexity);
                float tessellation_val = tessellation(p * complexity);

                // Blend between patterns based on geometry type
                float pattern = 0.0;
                if (u_geometry_type == 0) {
                    pattern = voronoi_val;
                } else if (u_geometry_type == 1) {
                    pattern = delaunay_val;
                } else if (u_geometry_type == 2) {
                    pattern = fractals_val;
                } else if (u_geometry_type == 3) {
                    pattern = tessellation_val;
                }

                // Add morphing between patterns
                pattern = mix(pattern, voronoi_val, u_morphing_factor);
                pattern = mix(pattern, fractals_val, 1.0 - u_morphing_factor);

                // Add noise for organic feel
                pattern += 0.1 * fbm(p * 2.0 + u_time);

                // Create color
                float hue = mod(pattern + u_time * 0.1, 1.0);
                vec3 color = getColor(hue);

                // Add glow and depth
                color *= 0.8 + 0.4 * pattern;
                color += 0.1 * vec3(0.5, 0.8, 1.0) * pattern;

                // Add vignette effect
                float vignette = 1.0 - dot(uv - 0.5, uv - 0.5) * 0.5;
                color *= vignette;

                gl_FragColor = vec4(color, 1.0);
            }
        `;
    }
}
