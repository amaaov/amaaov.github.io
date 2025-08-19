/**
 * Entropy Magma Scene
 * The original interactive entropy magma field with attractors and distortion
 *
 * DEVELOPMENT MODE:
 * To test this scene in isolation, use:
 *   sceneManager.enableDevelopmentMode('entropy_magma');
 *
 * To disable development mode:
 *   sceneManager.disableDevelopmentMode();
 *
 * Or press 'D' key to toggle development mode for current scene
 */

class EntropyMagmaScene extends Scene {
    constructor() {
        super("Entropy Magma", 180000); // 3 minutes

        // Interactive attractor system
        this.attractors = [];
        this.maxAttractors = 20;
        this.isDragging = false;
        this.dragStartPos = [0, 0];
        this.dragCurrentPos = [0, 0];

        // Built-in attractors (5 animated points)
        this.builtInAttractors = [
            { x: 0, y: 0, vx: 0.5, vy: 0.3, type: 'circular' },
            { x: 0.5, y: 0.5, vx: -0.4, vy: 0.6, type: 'figure8' },
            { x: 0.2, y: 0.8, vx: 0.3, vy: -0.5, type: 'spiral' },
            { x: 0.8, y: 0.2, vx: -0.6, vy: -0.2, type: 'lemniscate' },
            { x: 0.3, y: 0.3, vx: 0.2, vy: 0.4, type: 'complex' }
        ];

        // Lyrics system
        this.lyrics = [
            "ENTROPY FLOWS LIKE MAGMA",
            "CHAOS DANCES IN THE VOID",
            "SYNTHESIZER DREAMS",
            "DIGITAL RAIN FALLS",
            "QUANTUM FLUX RESONATES",
            "NEURAL NETWORK PULSES",
            "CYBERNETIC HEARTBEAT",
            "FRACTAL MEMORIES",
            "GLITCH IN THE MATRIX",
            "ELECTRONIC SOUL",
            "BINARY SUNSET",
            "ALGORITHMIC LOVE",
            "DIGITAL GHOSTS",
            "SYNTHWAVE NOSTALGIA",
            "QUANTUM ENTANGLEMENT",
            "NEURAL PATHWAYS",
            "CYBERPUNK DREAMS",
            "FRACTAL GEOMETRY",
            "GLITCH AESTHETICS",
            "ELECTRONIC MEDITATION",
            "BINARY CONSCIOUSNESS",
            "ALGORITHMIC BEAUTY",
            "DIGITAL MYSTICISM",
            "SYNTHWAVE REVOLUTION",
            "QUANTUM REALITY",
            "NEURAL SYMPHONY",
            "CYBERNETIC EVOLUTION",
            "FRACTAL INFINITY",
            "GLITCH PARADISE",
            "ELECTRONIC TRANSCENDENCE"
        ];

        this.currentLyric = "";
        this.lyricStartTime = 0;
        this.lyricDuration = 4000; // 4 seconds per lyric
        this.lyricFadeIn = 500; // 500ms fade in
        this.lyricFadeOut = 500; // 500ms fade out
        this.lyricOpacity = 0;
        this.lyricPosition = { x: 0.5, y: 0.3 };
        this.lyricVelocity = { x: 0.001, y: 0.0005 };

        console.log('🌋 EntropyMagmaScene constructed - ready to flow with chromatic chaos and lyrical entropy');
    }

    onUpdate(deltaTime, currentTime) {
        // Update built-in attractors
        this.updateBuiltInAttractors(deltaTime);

        // Update custom attractors
        this.updateCustomAttractors(deltaTime);

        // Handle input for adding attractors and distortion
        this.handleInput();

        // Update lyrics system
        this.updateLyrics(currentTime);
    }

    onRender(renderer) {
        // Prepare attractor data for shader
        const attractorPositions = new Float32Array(40); // 20 attractors * 2 coords
        const attractorLives = new Float32Array(20);

        for (let i = 0; i < 20; i++) {
            if (i < this.attractors.length) {
                attractorPositions[i * 2] = this.attractors[i].x;
                attractorPositions[i * 2 + 1] = this.attractors[i].y;
                attractorLives[i] = this.attractors[i].life;
            } else {
                attractorPositions[i * 2] = 0.0;
                attractorPositions[i * 2 + 1] = 0.0;
                attractorLives[i] = 0.0;
            }
        }

        // Prepare built-in attractor data
        const builtInPositions = new Float32Array(10); // 5 attractors * 2 coords
        for (let i = 0; i < 5; i++) {
            builtInPositions[i * 2] = this.builtInAttractors[i].x;
            builtInPositions[i * 2 + 1] = this.builtInAttractors[i].y;
        }

        // Set uniforms for the entropy magma shader
        const uniforms = {
            u_time: this.time,
            u_progress: this.progress,
            u_resolution: [renderer.canvas.width, renderer.canvas.height],
            u_attractor_positions: attractorPositions,
            u_attractor_lives: attractorLives,
            u_builtin_positions: builtInPositions,
            u_drag_start: this.dragStartPos,
            u_drag_current: this.dragCurrentPos,
            u_is_dragging: this.isDragging ? 1.0 : 0.0,
            // Text rendering uniforms
            u_lyric_opacity: this.lyricOpacity,
            u_lyric_position: [this.lyricPosition.x, this.lyricPosition.y],
            u_lyric_time: this.time
        };

        renderer.setUniforms(uniforms);
        renderer.render();
    }

    onCleanup() {
        this.attractors = [];
        this.isDragging = false;
    }

    updateBuiltInAttractors(deltaTime) {
        const dt = deltaTime * 0.001;

        this.builtInAttractors.forEach((attractor, index) => {
            // Update position based on type
            switch (attractor.type) {
                case 'circular':
                    attractor.x += attractor.vx * dt;
                    attractor.y += attractor.vy * dt;
                    // Circular motion
                    const angle = this.time * 0.5 + index;
                    attractor.x = 0.5 + 0.3 * Math.cos(angle);
                    attractor.y = 0.5 + 0.3 * Math.sin(angle);
                    break;

                case 'figure8':
                    const t = this.time * 0.3 + index;
                    attractor.x = 0.5 + 0.4 * Math.sin(t);
                    attractor.y = 0.5 + 0.2 * Math.sin(t * 2);
                    break;

                case 'spiral':
                    const spiralAngle = this.time * 0.4 + index;
                    const spiralRadius = 0.1 + 0.2 * (this.time * 0.1);
                    attractor.x = 0.5 + spiralRadius * Math.cos(spiralAngle);
                    attractor.y = 0.5 + spiralRadius * Math.sin(spiralAngle);
                    break;

                case 'lemniscate':
                    const lemniscateAngle = this.time * 0.6 + index;
                    const r = 0.3 / (1 + Math.cos(lemniscateAngle) * Math.cos(lemniscateAngle));
                    attractor.x = 0.5 + r * Math.cos(lemniscateAngle);
                    attractor.y = 0.5 + r * Math.sin(lemniscateAngle);
                    break;

                case 'complex':
                    const complexT = this.time * 0.7 + index;
                    attractor.x = 0.5 + 0.3 * Math.sin(complexT) * Math.cos(complexT * 0.5);
                    attractor.y = 0.5 + 0.3 * Math.cos(complexT) * Math.sin(complexT * 0.7);
                    break;
            }

            // Wrap around screen edges
            attractor.x = (attractor.x + 1.0) % 1.0;
            attractor.y = (attractor.y + 1.0) % 1.0;
        });
    }

    updateCustomAttractors(deltaTime) {
        const dt = deltaTime * 0.001;

        for (let i = this.attractors.length - 1; i >= 0; i--) {
            const attractor = this.attractors[i];

            // Update position
            attractor.x += attractor.vx * dt;
            attractor.y += attractor.vy * dt;

            // Bounce off edges
            if (attractor.x <= 0 || attractor.x >= 1) {
                attractor.vx *= -0.8;
                attractor.x = Math.max(0, Math.min(1, attractor.x));
            }
            if (attractor.y <= 0 || attractor.y >= 1) {
                attractor.vy *= -0.8;
                attractor.y = Math.max(0, Math.min(1, attractor.y));
            }

            // Update life
            attractor.life -= dt / 10.0; // 10 second lifetime

            // Remove dead attractors
            if (attractor.life <= 0) {
                this.attractors.splice(i, 1);
            }
        }
    }

    handleInput() {
        // Handle mouse/touch input for adding attractors
        if (this.inputState.mouse.pressed && !this.isDragging) {
            this.addAttractor(this.inputState.mouse.x, this.inputState.mouse.y);
        }

        if (this.inputState.touch.pressed && !this.isDragging) {
            this.addAttractor(this.inputState.touch.x, this.inputState.touch.y);
        }

        // Handle drag distortion
        if (this.inputState.mouse.pressed || this.inputState.touch.pressed) {
            if (!this.isDragging) {
                this.isDragging = true;
                this.dragStartPos = [
                    this.inputState.mouse.pressed ? this.inputState.mouse.x : this.inputState.touch.x,
                    this.inputState.mouse.pressed ? this.inputState.mouse.y : this.inputState.touch.y
                ];
            }

            this.dragCurrentPos = [
                this.inputState.mouse.pressed ? this.inputState.mouse.x : this.inputState.touch.x,
                this.inputState.mouse.pressed ? this.inputState.mouse.y : this.inputState.touch.y
            ];
        } else {
            this.isDragging = false;
        }
    }

    addAttractor(x, y) {
        if (this.attractors.length >= this.maxAttractors) {
            // Remove oldest attractor
            this.attractors.shift();
        }

        const attractor = {
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 2.0,
            vy: (Math.random() - 0.5) * 2.0,
            life: 1.0
        };

        this.attractors.push(attractor);
    }

    getFragmentShader() {
        return `
            precision highp float;

            uniform float u_time;
            uniform float u_progress;
            uniform vec2 u_resolution;
            uniform float u_attractor_positions[40]; // 20 attractors * 2 coords
            uniform float u_attractor_lives[20];
            uniform float u_builtin_positions[10]; // 5 attractors * 2 coords
            uniform vec2 u_drag_start;
            uniform vec2 u_drag_current;
            uniform float u_is_dragging;
            uniform float u_lyric_opacity;
            uniform vec2 u_lyric_position;
            uniform float u_lyric_time;

            varying vec2 v_uv;

            // Noise functions
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
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

            vec3 hsv2rgb(vec3 c) {
                vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }

            // Text rendering functions
            float char(vec2 uv, float n) {
                uv.x = uv.x * 2.0 - 1.0;
                uv.y = uv.y * 2.0 - 1.0;

                // Simple character patterns (basic font)
                float d = 0.0;

                if (n < 0.5) { // A
                    d = max(abs(uv.x) - 0.3, uv.y - 0.8) + max(abs(uv.x) - 0.3, -uv.y - 0.8);
                } else if (n < 1.5) { // B
                    d = max(abs(uv.x) - 0.3, abs(uv.y) - 0.8) + max(uv.x - 0.3, abs(uv.y) - 0.4);
                } else if (n < 2.5) { // C
                    d = max(length(uv - vec2(0.3, 0.0)) - 0.8, -uv.x - 0.3);
                } else if (n < 3.5) { // D
                    d = max(abs(uv.x) - 0.3, abs(uv.y) - 0.8) + max(uv.x - 0.3, abs(uv.y) - 0.8);
                } else if (n < 4.5) { // E
                    d = max(abs(uv.x) - 0.3, abs(uv.y) - 0.8) + max(uv.x - 0.3, abs(uv.y) - 0.4);
                } else if (n < 5.5) { // F
                    d = max(abs(uv.x) - 0.3, uv.y - 0.8) + max(uv.x - 0.3, abs(uv.y) - 0.4);
                } else if (n < 6.5) { // G
                    d = max(length(uv - vec2(0.3, 0.0)) - 0.8, max(-uv.x - 0.3, uv.x - 0.6));
                } else if (n < 7.5) { // H
                    d = max(abs(uv.x) - 0.3, abs(uv.y) - 0.8) + max(abs(uv.x) - 0.3, abs(uv.y) - 0.4);
                } else if (n < 8.5) { // I
                    d = max(abs(uv.x) - 0.1, abs(uv.y) - 0.8);
                } else if (n < 9.5) { // J
                    d = max(abs(uv.x) - 0.1, uv.y - 0.8) + max(uv.x - 0.1, -uv.y - 0.8);
                } else if (n < 10.5) { // K
                    d = max(abs(uv.x) - 0.3, uv.y - 0.8) + max(abs(uv.x - 0.3), abs(uv.y) - 0.4);
                } else if (n < 11.5) { // L
                    d = max(abs(uv.x) - 0.3, uv.y - 0.8) + max(uv.x - 0.3, -uv.y - 0.8);
                } else if (n < 12.5) { // M
                    d = max(abs(uv.x) - 0.3, uv.y - 0.8) + max(abs(uv.x - 0.3), abs(uv.y) - 0.8);
                } else if (n < 13.5) { // N
                    d = max(abs(uv.x) - 0.3, abs(uv.y) - 0.8) + max(abs(uv.x - 0.3), abs(uv.y) - 0.8);
                } else if (n < 14.5) { // O
                    d = length(uv - vec2(0.0, 0.0)) - 0.8;
                } else if (n < 15.5) { // P
                    d = max(abs(uv.x) - 0.3, uv.y - 0.8) + max(uv.x - 0.3, abs(uv.y) - 0.4);
                } else if (n < 16.5) { // Q
                    d = max(length(uv - vec2(0.0, 0.0)) - 0.8, length(uv - vec2(0.3, -0.3)) - 0.2);
                } else if (n < 17.5) { // R
                    d = max(abs(uv.x) - 0.3, uv.y - 0.8) + max(uv.x - 0.3, abs(uv.y) - 0.4);
                } else if (n < 18.5) { // S
                    d = max(length(uv - vec2(0.0, 0.0)) - 0.8, length(uv - vec2(0.0, 0.0)) - 0.6);
                } else if (n < 19.5) { // T
                    d = max(abs(uv.x) - 0.3, uv.y - 0.8) + max(abs(uv.x) - 0.3, abs(uv.y) - 0.4);
                } else if (n < 20.5) { // U
                    d = max(abs(uv.x) - 0.3, uv.y - 0.8) + max(uv.x - 0.3, -uv.y - 0.8);
                } else if (n < 21.5) { // V
                    d = max(abs(uv.x) - 0.3, uv.y - 0.8) + max(abs(uv.x - 0.3), abs(uv.y) - 0.8);
                } else if (n < 22.5) { // W
                    d = max(abs(uv.x) - 0.3, uv.y - 0.8) + max(abs(uv.x - 0.3), abs(uv.y) - 0.8);
                } else if (n < 23.5) { // X
                    d = max(abs(uv.x - uv.y) - 0.1, abs(uv.x + uv.y) - 0.1);
                } else if (n < 24.5) { // Y
                    d = max(abs(uv.x) - 0.3, uv.y - 0.8) + max(abs(uv.x - 0.3), abs(uv.y) - 0.4);
                } else if (n < 25.5) { // Z
                    d = max(abs(uv.x) - 0.3, abs(uv.y) - 0.8) + max(abs(uv.x - 0.3), abs(uv.y) - 0.8);
                } else { // Space
                    d = 1.0;
                }

                return smoothstep(0.1, 0.0, d);
            }

            float text(vec2 uv, vec2 pos, float scale) {
                // Simple text rendering - create a pattern that looks like text
                vec2 p = (uv - pos) / scale;

                // Create a text-like pattern using noise and sine waves
                float text = 0.0;
                text += sin(p.x * 20.0 + u_lyric_time * 2.0) * 0.5;
                text += sin(p.y * 10.0 + u_lyric_time * 1.5) * 0.3;
                text += noise(p * 5.0 + u_lyric_time * 0.5) * 0.4;

                // Create letter-like shapes (unrolled)
                float letters = 0.0;
                letters += char(p - vec2(0.0, 0.0), 0.0);
                letters += char(p - vec2(0.15, 0.0), 1.0);
                letters += char(p - vec2(0.30, 0.0), 2.0);
                letters += char(p - vec2(0.45, 0.0), 3.0);
                letters += char(p - vec2(0.60, 0.0), 4.0);
                letters += char(p - vec2(0.75, 0.0), 5.0);
                letters += char(p - vec2(0.90, 0.0), 6.0);
                letters += char(p - vec2(1.05, 0.0), 7.0);

                return max(text, letters * 0.8);
            }

            void main() {
                vec2 uv = v_uv;

                // Apply drag distortion
                if (u_is_dragging > 0.5) {
                    vec2 drag_vec = u_drag_current - u_drag_start;
                    float dist = length(uv - u_drag_start);
                    float distortion_strength = 0.1 / (1.0 + dist * 10.0);
                    uv += drag_vec * distortion_strength;
                }

                // Calculate influence from built-in attractors (unrolled loop)
                float builtin_influence = 0.0;
                vec2 attractor_pos0 = vec2(u_builtin_positions[0], u_builtin_positions[1]);
                vec2 attractor_pos1 = vec2(u_builtin_positions[2], u_builtin_positions[3]);
                vec2 attractor_pos2 = vec2(u_builtin_positions[4], u_builtin_positions[5]);
                vec2 attractor_pos3 = vec2(u_builtin_positions[6], u_builtin_positions[7]);
                vec2 attractor_pos4 = vec2(u_builtin_positions[8], u_builtin_positions[9]);

                builtin_influence += 0.3 / (1.0 + length(uv - attractor_pos0) * 5.0);
                builtin_influence += 0.3 / (1.0 + length(uv - attractor_pos1) * 5.0);
                builtin_influence += 0.3 / (1.0 + length(uv - attractor_pos2) * 5.0);
                builtin_influence += 0.3 / (1.0 + length(uv - attractor_pos3) * 5.0);
                builtin_influence += 0.3 / (1.0 + length(uv - attractor_pos4) * 5.0);

                // Calculate influence from custom attractors (unrolled for first 10)
                float custom_influence = 0.0;

                // Attractor 0
                float life0 = u_attractor_lives[0];
                if (life0 > 0.0) {
                    vec2 pos0 = vec2(u_attractor_positions[0], u_attractor_positions[1]);
                    custom_influence += 0.5 * life0 / (1.0 + length(uv - pos0) * 3.0);
                }

                // Attractor 1
                float life1 = u_attractor_lives[1];
                if (life1 > 0.0) {
                    vec2 pos1 = vec2(u_attractor_positions[2], u_attractor_positions[3]);
                    custom_influence += 0.5 * life1 / (1.0 + length(uv - pos1) * 3.0);
                }

                // Attractor 2
                float life2 = u_attractor_lives[2];
                if (life2 > 0.0) {
                    vec2 pos2 = vec2(u_attractor_positions[4], u_attractor_positions[5]);
                    custom_influence += 0.5 * life2 / (1.0 + length(uv - pos2) * 3.0);
                }

                // Attractor 3
                float life3 = u_attractor_lives[3];
                if (life3 > 0.0) {
                    vec2 pos3 = vec2(u_attractor_positions[6], u_attractor_positions[7]);
                    custom_influence += 0.5 * life3 / (1.0 + length(uv - pos3) * 3.0);
                }

                // Attractor 4
                float life4 = u_attractor_lives[4];
                if (life4 > 0.0) {
                    vec2 pos4 = vec2(u_attractor_positions[8], u_attractor_positions[9]);
                    custom_influence += 0.5 * life4 / (1.0 + length(uv - pos4) * 3.0);
                }

                // Attractor 5
                float life5 = u_attractor_lives[5];
                if (life5 > 0.0) {
                    vec2 pos5 = vec2(u_attractor_positions[10], u_attractor_positions[11]);
                    custom_influence += 0.5 * life5 / (1.0 + length(uv - pos5) * 3.0);
                }

                // Attractor 6
                float life6 = u_attractor_lives[6];
                if (life6 > 0.0) {
                    vec2 pos6 = vec2(u_attractor_positions[12], u_attractor_positions[13]);
                    custom_influence += 0.5 * life6 / (1.0 + length(uv - pos6) * 3.0);
                }

                // Attractor 7
                float life7 = u_attractor_lives[7];
                if (life7 > 0.0) {
                    vec2 pos7 = vec2(u_attractor_positions[14], u_attractor_positions[15]);
                    custom_influence += 0.5 * life7 / (1.0 + length(uv - pos7) * 3.0);
                }

                // Attractor 8
                float life8 = u_attractor_lives[8];
                if (life8 > 0.0) {
                    vec2 pos8 = vec2(u_attractor_positions[16], u_attractor_positions[17]);
                    custom_influence += 0.5 * life8 / (1.0 + length(uv - pos8) * 3.0);
                }

                // Attractor 9
                float life9 = u_attractor_lives[9];
                if (life9 > 0.0) {
                    vec2 pos9 = vec2(u_attractor_positions[18], u_attractor_positions[19]);
                    custom_influence += 0.5 * life9 / (1.0 + length(uv - pos9) * 3.0);
                }

                // Generate noise for organic movement
                vec2 noise_uv = uv * 2.0 + u_time * 0.5;
                float noise_val = fbm(noise_uv);

                // Combine influences
                float total_influence = builtin_influence + custom_influence + noise_val * 0.3;

                // Create color
                float hue = mod(total_influence + u_time * 0.2, 1.0);
                float saturation = 0.8 + 0.2 * sin(u_time * 0.5);
                float value = 0.7 + 0.3 * total_influence;

                vec3 color = hsv2rgb(vec3(hue, saturation, value));

                // Add glow effect
                color += vec3(0.1, 0.05, 0.2) * custom_influence;

                // Render lyrics text
                float textAlpha = text(uv, u_lyric_position, 0.02) * u_lyric_opacity;

                // Create contrasting text color
                vec3 textColor = vec3(1.0, 1.0, 1.0); // White text
                vec3 textGlow = vec3(0.0, 0.8, 1.0); // Cyan glow

                // Add text outline for better contrast
                float outline = text(uv, u_lyric_position, 0.021) * u_lyric_opacity;
                float textCore = text(uv, u_lyric_position, 0.019) * u_lyric_opacity;

                // Blend text with background
                color = mix(color, vec3(0.0, 0.0, 0.0), outline * 0.8); // Black outline
                color = mix(color, textGlow, outline * 0.6); // Glow effect
                color = mix(color, textColor, textCore); // White core

                // Add subtle text animation
                float textPulse = 0.5 + 0.5 * sin(u_lyric_time * 3.0);
                color += textGlow * textAlpha * textPulse * 0.3;

                gl_FragColor = vec4(color, 1.0);
            }
        `;
    }

    updateLyrics(currentTime) {
        // Initialize first lyric
        if (this.currentLyric === "") {
            this.currentLyric = this.lyrics[Math.floor(Math.random() * this.lyrics.length)];
            this.lyricStartTime = currentTime;
        }

        const elapsed = currentTime - this.lyricStartTime;
        const cycleTime = this.lyricDuration + this.lyricFadeIn + this.lyricFadeOut;

        // Check if it's time for a new lyric
        if (elapsed >= cycleTime) {
            this.currentLyric = this.lyrics[Math.floor(Math.random() * this.lyrics.length)];
            this.lyricStartTime = currentTime;
            this.lyricOpacity = 0;
        }

        // Calculate opacity based on fade in/out
        if (elapsed < this.lyricFadeIn) {
            // Fade in
            this.lyricOpacity = elapsed / this.lyricFadeIn;
        } else if (elapsed > this.lyricDuration + this.lyricFadeIn) {
            // Fade out
            const fadeOutStart = this.lyricDuration + this.lyricFadeIn;
            const fadeOutElapsed = elapsed - fadeOutStart;
            this.lyricOpacity = 1.0 - (fadeOutElapsed / this.lyricFadeOut);
        } else {
            // Full opacity
            this.lyricOpacity = 1.0;
        }

        // Clamp opacity
        this.lyricOpacity = Math.max(0, Math.min(1, this.lyricOpacity));

        // Update lyric position with subtle movement
        this.lyricPosition.x += this.lyricVelocity.x * Math.sin(this.time * 0.5);
        this.lyricPosition.y += this.lyricVelocity.y * Math.cos(this.time * 0.3);

        // Keep lyrics within bounds
        this.lyricPosition.x = Math.max(0.1, Math.min(0.9, this.lyricPosition.x));
        this.lyricPosition.y = Math.max(0.1, Math.min(0.8, this.lyricPosition.y));
    }
}
