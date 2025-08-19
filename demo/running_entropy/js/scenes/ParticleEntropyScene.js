/**
 * Particle Entropy Scene
 * Dynamic particle systems with physics, trails, and emergent behaviors
 *
 * DEVELOPMENT MODE:
 * To test this scene in isolation, use:
 *   sceneManager.enableDevelopmentMode('particle_entropy');
 *
 * To disable development mode:
 *   sceneManager.disableDevelopmentMode();
 *
 * Or press 'D' key to toggle development mode for current scene
 */

class ParticleEntropyScene extends Scene {
    constructor() {
        super("Particle Entropy", 180000); // 3 minutes

        // Particle system
        this.particles = [];
        this.maxParticles = 50; // Reduced from 500 to match shader
        this.particleSize = 0.02;
        this.particleLifetime = 10.0; // seconds
        this.trailLength = 20;

        // Physics
        this.gravity = [0, 0.1];
        this.wind = [0.05, 0];
        this.turbulence = 0.1;

        // Emitters
        this.emitters = [
            { x: 0.2, y: 0.8, vx: 0.1, vy: -0.2, rate: 5.0 },
            { x: 0.8, y: 0.2, vx: -0.1, vy: 0.2, rate: 3.0 },
            { x: 0.5, y: 0.5, vx: 0, vy: 0, rate: 2.0 }
        ];

        // Bloom effect
        this.bloomIntensity = 0.3;

        console.log('✨ ParticleEntropyScene constructed - ready to dance with quantum chaos');
    }

    onUpdate(deltaTime, currentTime) {
        const dt = deltaTime * 0.001;

        // Update physics parameters
        this.wind[0] = 0.2 * Math.sin(this.time * 0.3);
        this.wind[1] = 0.1 * Math.cos(this.time * 0.5);
        this.turbulence = 0.3 + 0.4 * Math.sin(this.time * 0.2);

        // Update emitters
        this.updateEmitters(dt);

        // Update particles
        this.updateParticles(dt);

        // Spawn new particles
        this.spawnParticles(dt);
    }

    onRender(renderer) {
        // Prepare particle data for shader
        const particleData = new Float32Array(this.maxParticles * 6); // x, y, vx, vy, life, size
        const trailData = new Float32Array(this.maxParticles * this.trailLength * 2); // trail positions

        for (let i = 0; i < this.maxParticles; i++) {
            const baseIndex = i * 6;
            const trailBaseIndex = i * this.trailLength * 2;

            if (i < this.particles.length) {
                const particle = this.particles[i];

                // Particle data
                particleData[baseIndex] = particle.x;
                particleData[baseIndex + 1] = particle.y;
                particleData[baseIndex + 2] = particle.vx;
                particleData[baseIndex + 3] = particle.vy;
                particleData[baseIndex + 4] = particle.life;
                particleData[baseIndex + 5] = particle.size;

                // Trail data
                for (let j = 0; j < this.trailLength; j++) {
                    const trailIndex = trailBaseIndex + j * 2;
                    if (j < particle.trail.length) {
                        trailData[trailIndex] = particle.trail[j].x;
                        trailData[trailIndex + 1] = particle.trail[j].y;
                    } else {
                        trailData[trailIndex] = particle.x;
                        trailData[trailIndex + 1] = particle.y;
                    }
                }
            } else {
                // Empty particle slot
                particleData[baseIndex + 4] = 0.0; // life = 0
            }
        }

        const uniforms = {
            u_time: this.time,
            u_progress: this.progress,
            u_resolution: [renderer.canvas.width, renderer.canvas.height],
            u_particle_count: this.particles.length,
            u_max_particles: this.maxParticles,
            u_trail_length: this.trailLength,
            u_particle_data: particleData,
            u_trail_data: trailData,
            u_gravity: this.gravity,
            u_wind: this.wind,
            u_turbulence: this.turbulence,
            u_particle_size: this.particleSize,
            u_bloom_intensity: this.bloomIntensity
        };

        renderer.setUniforms(uniforms);
        renderer.render();
    }

    onCleanup() {
        this.particles = [];
    }

    updateEmitters(dt) {
        this.emitters.forEach((emitter, index) => {
            // Animate emitter positions
            emitter.x = 0.2 + 0.6 * Math.sin(this.time * 0.1 + index);
            emitter.y = 0.1 + 0.1 * Math.sin(this.time * 0.2 + index);

            // Vary emission rate
            emitter.rate = 8 + 4 * Math.sin(this.time * 0.3 + index);
        });
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];

            // Update trail
            particle.trail.unshift({ x: particle.x, y: particle.y });
            if (particle.trail.length > this.trailLength) {
                particle.trail.pop();
            }

            // Apply physics
            particle.vx += this.gravity[0] * dt + this.wind[0] * dt;
            particle.vy += this.gravity[1] * dt + this.wind[1] * dt;

            // Add turbulence
            particle.vx += (Math.random() - 0.5) * this.turbulence * dt;
            particle.vy += (Math.random() - 0.5) * this.turbulence * dt;

            // Update position
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;

            // Bounce off edges
            if (particle.x <= 0 || particle.x >= 1) {
                particle.vx *= -0.8;
                particle.x = Math.max(0, Math.min(1, particle.x));
            }
            if (particle.y <= 0 || particle.y >= 1) {
                particle.vy *= -0.8;
                particle.y = Math.max(0, Math.min(1, particle.y));
            }

            // Update life
            particle.life -= dt / this.particleLifetime;

            // Remove dead particles
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    spawnParticles(dt) {
        this.emitters.forEach(emitter => {
            const spawnCount = Math.floor(emitter.rate * dt);

            for (let i = 0; i < spawnCount; i++) {
                if (this.particles.length < this.maxParticles) {
                    const particle = {
                        x: emitter.x + (Math.random() - 0.5) * 0.1,
                        y: emitter.y + (Math.random() - 0.5) * 0.1,
                        vx: emitter.vx + (Math.random() - 0.5) * 0.2,
                        vy: emitter.vy + (Math.random() - 0.5) * 0.2,
                        life: 1.0,
                        size: this.particleSize * (0.5 + Math.random() * 0.5),
                        trail: []
                    };

                    this.particles.push(particle);
                }
            }
        });
    }

    getFragmentShader() {
        return `
            precision highp float;

            uniform float u_time;
            uniform float u_progress;
            uniform vec2 u_resolution;
            uniform int u_particle_count;
            uniform int u_max_particles;
            uniform int u_trail_length;
            uniform float u_particle_data[3000]; // 500 particles * 6 values
            uniform float u_trail_data[20000]; // 500 particles * 20 trail points * 2 coords
            uniform vec2 u_gravity;
            uniform vec2 u_wind;
            uniform float u_turbulence;
            uniform float u_particle_size;
            uniform float u_bloom_intensity;

            varying vec2 v_uv;

            // Utility functions
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

            void main() {
                vec2 uv = v_uv;
                vec3 color = vec3(0.0);

                // Background gradient
                vec3 bgColor = vec3(0.05, 0.02, 0.1);
                color = bgColor;

                // Render particles and trails (unrolled for first 50 particles)
                int particleCount = u_particle_count;
                if (particleCount > 50) {
                    particleCount = 50;
                }

                // Particle 0
                if (0 < particleCount) {
                    float life = u_particle_data[4];
                    if (life > 0.0) {
                        vec2 particlePos = vec2(u_particle_data[0], u_particle_data[1]);
                        float size = u_particle_data[5];
                        float dist = length(uv - particlePos);
                        float particleAlpha = smoothstep(size * 0.01, 0.0, dist) * life;
                        if (particleAlpha > 0.0) {
                            float hue = mod(u_time * 0.2 + 0.0 * 0.1, 1.0);
                            vec3 particleColor = hsv2rgb(vec3(hue, 0.8, 1.0));
                            color = mix(color, particleColor, particleAlpha * 0.8);
                        }
                    }
                }

                // Particle 1
                if (1 < particleCount) {
                    float life = u_particle_data[10];
                    if (life > 0.0) {
                        vec2 particlePos = vec2(u_particle_data[6], u_particle_data[7]);
                        float size = u_particle_data[11];
                        float dist = length(uv - particlePos);
                        float particleAlpha = smoothstep(size * 0.01, 0.0, dist) * life;
                        if (particleAlpha > 0.0) {
                            float hue = mod(u_time * 0.2 + 1.0 * 0.1, 1.0);
                            vec3 particleColor = hsv2rgb(vec3(hue, 0.8, 1.0));
                            color = mix(color, particleColor, particleAlpha * 0.8);
                        }
                    }
                }

                // Particle 2
                if (2 < particleCount) {
                    float life = u_particle_data[16];
                    if (life > 0.0) {
                        vec2 particlePos = vec2(u_particle_data[12], u_particle_data[13]);
                        float size = u_particle_data[17];
                        float dist = length(uv - particlePos);
                        float particleAlpha = smoothstep(size * 0.01, 0.0, dist) * life;
                        if (particleAlpha > 0.0) {
                            float hue = mod(u_time * 0.2 + 2.0 * 0.1, 1.0);
                            vec3 particleColor = hsv2rgb(vec3(hue, 0.8, 1.0));
                            color = mix(color, particleColor, particleAlpha * 0.8);
                        }
                    }
                }

                // Particle 3
                if (3 < particleCount) {
                    float life = u_particle_data[22];
                    if (life > 0.0) {
                        vec2 particlePos = vec2(u_particle_data[18], u_particle_data[19]);
                        float size = u_particle_data[23];
                        float dist = length(uv - particlePos);
                        float particleAlpha = smoothstep(size * 0.01, 0.0, dist) * life;
                        if (particleAlpha > 0.0) {
                            float hue = mod(u_time * 0.2 + 3.0 * 0.1, 1.0);
                            vec3 particleColor = hsv2rgb(vec3(hue, 0.8, 1.0));
                            color = mix(color, particleColor, particleAlpha * 0.8);
                        }
                    }
                }

                // Particle 4
                if (4 < particleCount) {
                    float life = u_particle_data[28];
                    if (life > 0.0) {
                        vec2 particlePos = vec2(u_particle_data[24], u_particle_data[25]);
                        float size = u_particle_data[29];
                        float dist = length(uv - particlePos);
                        float particleAlpha = smoothstep(size * 0.01, 0.0, dist) * life;
                        if (particleAlpha > 0.0) {
                            float hue = mod(u_time * 0.2 + 4.0 * 0.1, 1.0);
                            vec3 particleColor = hsv2rgb(vec3(hue, 0.8, 1.0));
                            color = mix(color, particleColor, particleAlpha * 0.8);
                        }
                    }
                }

                // Add bloom effect (simplified for first 10 particles)
                vec3 bloom = vec3(0.0);

                // Bloom particle 0
                if (0 < particleCount) {
                    float life = u_particle_data[4];
                    if (life > 0.0) {
                        vec2 particlePos = vec2(u_particle_data[0], u_particle_data[1]);
                        float size = u_particle_data[5];
                        float dist = length(uv - particlePos);
                        float bloomAlpha = smoothstep(size * 0.05, 0.0, dist) * life * u_bloom_intensity;
                        if (bloomAlpha > 0.0) {
                            float hue = mod(u_time * 0.3 + 0.0 * 0.1, 1.0);
                            vec3 bloomColor = hsv2rgb(vec3(hue, 0.5, 0.6));
                            bloom += bloomColor * bloomAlpha;
                        }
                    }
                }

                // Bloom particle 1
                if (1 < particleCount) {
                    float life = u_particle_data[10];
                    if (life > 0.0) {
                        vec2 particlePos = vec2(u_particle_data[6], u_particle_data[7]);
                        float size = u_particle_data[11];
                        float dist = length(uv - particlePos);
                        float bloomAlpha = smoothstep(size * 0.05, 0.0, dist) * life * u_bloom_intensity;
                        if (bloomAlpha > 0.0) {
                            float hue = mod(u_time * 0.3 + 1.0 * 0.1, 1.0);
                            vec3 bloomColor = hsv2rgb(vec3(hue, 0.5, 0.6));
                            bloom += bloomColor * bloomAlpha;
                        }
                    }
                }

                // Bloom particle 2
                if (2 < particleCount) {
                    float life = u_particle_data[16];
                    if (life > 0.0) {
                        vec2 particlePos = vec2(u_particle_data[12], u_particle_data[13]);
                        float size = u_particle_data[17];
                        float dist = length(uv - particlePos);
                        float bloomAlpha = smoothstep(size * 0.05, 0.0, dist) * life * u_bloom_intensity;
                        if (bloomAlpha > 0.0) {
                            float hue = mod(u_time * 0.3 + 2.0 * 0.1, 1.0);
                            vec3 bloomColor = hsv2rgb(vec3(hue, 0.5, 0.6));
                            bloom += bloomColor * bloomAlpha;
                        }
                    }
                }

                color += bloom * 0.5;

                // Add noise for atmosphere
                float noiseVal = fbm(uv * 3.0 + u_time * 0.1) * 0.1;
                color += vec3(noiseVal);

                // Vignette
                float vignette = 1.0 - dot(uv - 0.5, uv - 0.5) * 0.3;
                color *= vignette;

                gl_FragColor = vec4(color, 1.0);
            }
        `;
    }
}
