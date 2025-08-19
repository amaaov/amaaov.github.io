document.addEventListener('DOMContentLoaded', function() {
const canvas = document.getElementById('gameCanvas');
const gl = canvas.getContext('webgl');

// --- WebGL helpers ---
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    }
    return shader;
}
function createProgram(gl, vsSource, fsSource) {
    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
    }
    return program;
}

const vsSource = `
attribute vec2 a_position;
uniform vec2 u_resolution;
void main() {
    vec2 zeroToOne = a_position / u_resolution;
    vec2 zeroToTwo = zeroToOne * 2.0;
    vec2 clipSpace = zeroToTwo - 1.0;
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
}`;
const fsSource = `
precision mediump float;
uniform vec4 u_color;
void main() {
    gl_FragColor = u_color;
}`;
const program = createProgram(gl, vsSource, fsSource);
const positionLocation = gl.getAttribLocation(program, 'a_position');
const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
const colorLocation = gl.getUniformLocation(program, 'u_color');
const positionBuffer = gl.createBuffer();

gl.useProgram(program);
gl.enableVertexAttribArray(positionLocation);
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

function drawRect(x, y, w, h, color) {
    gl.useProgram(program);
    const x1 = x, y1 = y, x2 = x + w, y2 = y + h;
    const vertices = new Float32Array([
        x1, y1, x2, y1, x1, y2,
        x1, y2, x2, y1, x2, y2
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STREAM_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform4fv(colorLocation, color);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

// Game settings
const GRID_SIZE = 20;
const CELL_SIZE = 64;
const COMPONENTS = ['resistor', 'capacitor', 'diode', 'transistor', 'ic', 'led', 'button'];

// Make canvas always fill the window
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Snake state
let snake = [{x: 0, y: 0, type: 'resistor'}];
let direction = {x: 1, y: 0};
let nextComponent = randomComponent();
let componentPos = randomEmptyCell();
let componentTimestamp = Date.now();
let gameOver = false;
let lastUpdate = 0;
let speed = 120; // ms per move

// Camera state
let camera = {x: 0, y: 0};
let cameraTarget = {x: 0, y: 0};
const CAMERA_LERP = 0.5; // Fast follow when needed

// Smooth snake rendering state
let renderSnake = [];

// Input state
let inputQueue = [];

// Spark effect state
let sparkTimer = 0;
let sparkPos = {x: 0, y: 0};

// --- Input Handlers ---
window.addEventListener('keydown', e => {
    let moved = false;
    switch (e.key) {
        case 'ArrowUp': inputQueue.push({x: 0, y: -1}); moved = true; break;
        case 'ArrowDown': inputQueue.push({x: 0, y: 1}); moved = true; break;
        case 'ArrowLeft': inputQueue.push({x: -1, y: 0}); moved = true; break;
        case 'ArrowRight': inputQueue.push({x: 1, y: 0}); moved = true; break;
        case 'Enter':
        case ' ': // Space
        case 'Escape':
            resetGame();
            break;
    }
    // Move snake instantly on input
    if (moved && !gameOver) {
        moveSnake();
        lastUpdate = performance.now();
    }
});

// Touch controls
let touchStart = null;
canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) touchStart = e.touches[0];
});
canvas.addEventListener('touchend', e => {
    if (!touchStart) return;
    const touchEnd = e.changedTouches[0];
    const dx = touchEnd.clientX - touchStart.clientX;
    const dy = touchEnd.clientY - touchStart.clientY;
    if (Math.abs(dx) > Math.abs(dy)) {
        inputQueue.push({x: dx > 0 ? 1 : -1, y: 0});
    } else {
        inputQueue.push({x: 0, y: dy > 0 ? 1 : -1});
    }
    touchStart = null;
});

// Gyro controls (mobile)
window.addEventListener('deviceorientation', e => {
    if (Math.abs(e.gamma) > Math.abs(e.beta)) {
        if (e.gamma > 15) inputQueue.push({x: 1, y: 0});
        else if (e.gamma < -15) inputQueue.push({x: -1, y: 0});
    } else {
        if (e.beta > 25) inputQueue.push({x: 0, y: 1});
        else if (e.beta < -5) inputQueue.push({x: 0, y: -1});
    }
});

// Bluetooth joystick/gamepad
window.addEventListener('gamepadconnected', () => {
    setInterval(() => {
        const gp = navigator.getGamepads()[0];
        if (!gp) return;
        if (gp.axes[0] > 0.5) inputQueue.push({x: 1, y: 0});
        else if (gp.axes[0] < -0.5) inputQueue.push({x: -1, y: 0});
        else if (gp.axes[1] > 0.5) inputQueue.push({x: 0, y: 1});
        else if (gp.axes[1] < -0.5) inputQueue.push({x: 0, y: -1});
    }, 100);
});

// --- Game Logic ---
function randomComponent() {
    return COMPONENTS[Math.floor(Math.random() * COMPONENTS.length)];
}
function randomEmptyCell() {
    // Place component near the snake's head, but not on the snake
    let pos;
    do {
        pos = {
            x: snake[0].x + Math.floor(Math.random() * 20 - 10),
            y: snake[0].y + Math.floor(Math.random() * 20 - 10)
        };
    } while (snake.some(s => s.x === pos.x && s.y === pos.y));
    return pos;
}
function randomVisibleCell() {
    // Place component within the visible screen area
    const minX = Math.floor(cameraTarget.x - (canvas.width / (2 * CELL_SIZE)) + 1);
    const maxX = Math.floor(cameraTarget.x + (canvas.width / (2 * CELL_SIZE)) - 1);
    const minY = Math.floor(cameraTarget.y - (canvas.height / (2 * CELL_SIZE)) + 1);
    const maxY = Math.floor(cameraTarget.y + (canvas.height / (2 * CELL_SIZE)) - 1);
    let pos;
    do {
        pos = {
            x: Math.floor(Math.random() * (maxX - minX + 1)) + minX,
            y: Math.floor(Math.random() * (maxY - minY + 1)) + minY
        };
    } while (snake.some(s => s.x === pos.x && s.y === pos.y));
    return pos;
}

function isComponentVisible() {
    const minX = camera.x - (canvas.width / (2 * CELL_SIZE));
    const maxX = camera.x + (canvas.width / (2 * CELL_SIZE));
    const minY = camera.y - (canvas.height / (2 * CELL_SIZE));
    const maxY = camera.y + (canvas.height / (2 * CELL_SIZE));
    return (
        componentPos.x >= minX && componentPos.x <= maxX &&
        componentPos.y >= minY && componentPos.y <= maxY
    );
}

function garbageCollectComponent() {
    const now = Date.now();
    const dx = componentPos.x - snake[0].x;
    const dy = componentPos.y - snake[0].y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (!isComponentVisible() && (now - componentTimestamp > 30000) && dist > 30) {
        // Respawn component within visible area
        componentPos = randomVisibleCell();
        componentTimestamp = now;
        nextComponent = randomComponent();
    }
}

function resetGame() {
    snake = [{x: 0, y: 0, type: 'resistor'}];
    direction = {x: 1, y: 0};
    nextComponent = randomComponent();
    componentPos = randomVisibleCell();
    componentTimestamp = Date.now();
    gameOver = false;
    lastUpdate = 0;
    camera = {x: 0, y: 0};
    cameraTarget = {x: 0, y: 0};
    renderSnake = snake.map(s => ({...s, fx: s.x, fy: s.y}));
}

function moveSnake() {
    if (inputQueue.length) {
        const next = inputQueue.shift();
        if (next.x !== -direction.x || next.y !== -direction.y) direction = next;
    }
    const head = {x: snake[0].x + direction.x, y: snake[0].y + direction.y, type: snake[0].type};
    if (snake.some(s => s.x === head.x && s.y === head.y)) {
        gameOver = true;
        return;
    }
    if (head.x === componentPos.x && head.y === componentPos.y) {
        head.type = nextComponent;
        snake.unshift(head);
        nextComponent = randomComponent();
        componentPos = randomVisibleCell();
        componentTimestamp = Date.now();
        // Spark effect
        sparkTimer = 18; // frames
        sparkPos = {x: head.x, y: head.y};
    } else {
        snake.unshift(head);
        snake.pop();
    }
    // Camera target follows head
    cameraTarget.x = head.x;
    cameraTarget.y = head.y;
    // Update renderSnake to match snake
    while (renderSnake.length < snake.length) {
        // Add new segment at the end
        const last = renderSnake[renderSnake.length - 1];
        renderSnake.push({...last});
    }
    while (renderSnake.length > snake.length) {
        renderSnake.pop();
    }
}

function smoothSnake() {
    // No smoothing, just copy positions
    for (let i = 0; i < snake.length; ++i) {
        if (!renderSnake[i]) renderSnake[i] = {...snake[i], fx: snake[i].x, fy: snake[i].y};
        renderSnake[i].fx = snake[i].x;
        renderSnake[i].fy = snake[i].y;
        renderSnake[i].type = snake[i].type;
    }
}

// --- Generative Background ---
const BG_TILE_SIZE = 512;
const bgFramebuffers = [];
const bgTextures = [];
for (let i = 0; i < 9; ++i) {
    const fb = gl.createFramebuffer();
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, BG_TILE_SIZE, BG_TILE_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    // Check framebuffer completeness
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        console.error('Framebuffer not complete for tile', i);
    }
    bgFramebuffers.push(fb);
    bgTextures.push(tex);
}
gl.bindFramebuffer(gl.FRAMEBUFFER, null);

// Simple generative background shader
const bgVsSource = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0, 1);
}`;
const bgFsSource = `
precision mediump float;
varying vec2 v_uv;
uniform float u_time;
uniform vec2 u_snake;
uniform float u_len;

// Simple 2D noise function
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
    float t = u_time * 0.12;
    vec2 uv = v_uv - 0.5;
    float angle = t + 2.0 * length(uv);
    float s = sin(angle), c = cos(angle);
    mat2 rot = mat2(c, -s, s, c);
    uv = rot * uv;
    uv += 0.5;

    // Layered noise
    float n1 = noise(uv * 6.0 + t * 0.2);
    float n2 = noise(uv * 12.0 - t * 0.3);
    float n3 = noise(uv * 24.0 + t * 0.5);
    float n = 0.5 * n1 + 0.3 * n2 + 0.2 * n3;

    // Color gradients
    float grad = smoothstep(0.0, 1.0, uv.y) * 0.7 + 0.3 * smoothstep(0.0, 1.0, uv.x);
    float swirl = 0.5 + 0.5 * sin(8.0 * (uv.x + uv.y) + t * 1.5);
    float depth = 0.5 + 0.5 * cos(10.0 * length(uv - 0.5) - t * 2.0);

    // Compose color
    vec3 base = mix(vec3(0.13, 0.15, 0.22), vec3(0.18, 0.22, 0.32), grad);
    vec3 swirlCol = mix(vec3(0.18, 0.22, 0.32), vec3(0.25, 0.18, 0.32), swirl);
    vec3 noiseCol = mix(base, swirlCol, n * 0.7 + 0.3 * depth);
    // Add a subtle color shift based on time and snake length
    float colorShift = 0.1 * sin(t + u_len * 0.2);
    noiseCol += colorShift * vec3(0.2, 0.1, 0.3);
    // Vignette
    float vignette = smoothstep(0.9, 0.5, distance(v_uv, vec2(0.5)));
    gl_FragColor = vec4(noiseCol, 1.0) * vignette;
}`;
const bgProgram = createProgram(gl, bgVsSource, bgFsSource);
const bgPosLoc = gl.getAttribLocation(bgProgram, 'a_position');
const bgTimeLoc = gl.getUniformLocation(bgProgram, 'u_time');
const bgSnakeLoc = gl.getUniformLocation(bgProgram, 'u_snake');
const bgLenLoc = gl.getUniformLocation(bgProgram, 'u_len');
const bgQuadBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, bgQuadBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1
]), gl.STATIC_DRAW);

function renderBgTile(tileX, tileY, time, snakeHead, snakeLen) {
    gl.useProgram(bgProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, bgFramebuffers[tileY * 3 + tileX]);
    gl.viewport(0, 0, BG_TILE_SIZE, BG_TILE_SIZE);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enableVertexAttribArray(bgPosLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, bgQuadBuffer);
    gl.vertexAttribPointer(bgPosLoc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(bgTimeLoc, time);
    gl.uniform2f(bgSnakeLoc, (snakeHead.x % 1 + 1) % 1, (snakeHead.y % 1 + 1) % 1);
    gl.uniform1f(bgLenLoc, snakeLen);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

// Helper: draw a textured quad (for background tiles)
function drawTexturedQuad(tex, x, y, size) {
    if (!window.texProgram) {
        const vs = `
        attribute vec2 a_position;
        attribute vec2 a_texcoord;
        uniform vec2 u_resolution;
        varying vec2 v_texcoord;
        void main() {
            vec2 zeroToOne = a_position / u_resolution;
            vec2 zeroToTwo = zeroToOne * 2.0;
            vec2 clipSpace = zeroToTwo - 1.0;
            gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
            v_texcoord = a_texcoord;
        }`;
        const fs = `
        precision mediump float;
        varying vec2 v_texcoord;
        uniform sampler2D u_tex;
        void main() {
            gl_FragColor = texture2D(u_tex, v_texcoord);
        }`;
        window.texProgram = createProgram(gl, vs, fs);
        window.texPosLoc = gl.getAttribLocation(window.texProgram, 'a_position');
        window.texCoordLoc = gl.getAttribLocation(window.texProgram, 'a_texcoord');
        window.texResLoc = gl.getUniformLocation(window.texProgram, 'u_resolution');
        window.texSamplerLoc = gl.getUniformLocation(window.texProgram, 'u_tex');
        window.texBuffer = gl.createBuffer();
        window.texCoordBuffer = gl.createBuffer();
    }
    gl.useProgram(window.texProgram);
    // Vertices (cover the correct area)
    const verts = new Float32Array([
        x, y,
        x + size, y,
        x, y + size,
        x, y + size,
        x + size, y,
        x + size, y + size
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, window.texBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STREAM_DRAW);
    gl.enableVertexAttribArray(window.texPosLoc);
    gl.vertexAttribPointer(window.texPosLoc, 2, gl.FLOAT, false, 0, 0);
    // Texcoords
    const coords = new Float32Array([
        0, 0, 1, 0, 0, 1,
        0, 1, 1, 0, 1, 1
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, window.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, coords, gl.STREAM_DRAW);
    gl.enableVertexAttribArray(window.texCoordLoc);
    gl.vertexAttribPointer(window.texCoordLoc, 2, gl.FLOAT, false, 0, 0);
    // Uniforms
    gl.uniform2f(window.texResLoc, canvas.width, canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(window.texSamplerLoc, 0);
    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    // Debug: draw a fallback color if nothing is rendered
    // drawRect(x, y, size, size, [1, 0, 0, 0.2]); // Uncomment to see tile area
}

function renderBackground(time) {
    // Calculate which tile the camera is in
    const camTileX = Math.floor(camera.x / (BG_TILE_SIZE / CELL_SIZE));
    const camTileY = Math.floor(camera.y / (BG_TILE_SIZE / CELL_SIZE));
    // Pre-render all 9 tiles (center, corners, sides)
    for (let dy = -1; dy <= 1; ++dy) {
        for (let dx = -1; dx <= 1; ++dx) {
            renderBgTile(dx + 1, dy + 1, time,
                {x: (camera.x + dx * BG_TILE_SIZE / CELL_SIZE) / (BG_TILE_SIZE / CELL_SIZE),
                 y: (camera.y + dy * BG_TILE_SIZE / CELL_SIZE) / (BG_TILE_SIZE / CELL_SIZE)},
                snake.length);
        }
    }
    // Draw the 9 tiles to the main framebuffer, blending seamlessly
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Ensure drawing to main framebuffer
    for (let dy = -1; dy <= 1; ++dy) {
        for (let dx = -1; dx <= 1; ++dx) {
            const tex = bgTextures[(dy + 1) * 3 + (dx + 1)];
            const tileWorldX = (camTileX + dx) * BG_TILE_SIZE;
            const tileWorldY = (camTileY + dy) * BG_TILE_SIZE;
            const screenX = Math.floor(canvas.width / 2 - (camera.x * CELL_SIZE - tileWorldX));
            const screenY = Math.floor(canvas.height / 2 - (camera.y * CELL_SIZE - tileWorldY));
            drawTexturedQuad(tex, screenX, screenY, BG_TILE_SIZE);
        }
    }
}

// Helper: draw a glowing line (signal)
function drawGlowLine(x1, y1, x2, y2, color, thickness) {
    for (let i = 6; i >= 1; --i) {
        let alpha = 0.04 * i;
        let t = thickness + i * 2;
        drawRect(
            x1 - t / 2, y1 - t / 2, x2 - x1 + t, y2 - y1 + t,
            [color[0], color[1], color[2], alpha]
        );
    }
    drawRect(
        x1 - thickness / 2, y1 - thickness / 2, x2 - x1 + thickness, y2 - y1 + thickness,
        [color[0], color[1], color[2], 1]
    );
}

// Helper: draw an ellipse using a single rectangle (for performance)
function drawEllipse(cx, cy, rx, ry, color) {
    // For now, just draw a rectangle as a placeholder for an ellipse
    drawRect(cx - rx, cy - ry, rx * 2, ry * 2, color);
}

function drawComponentShape(type, x, y, size, highlightY = 0.18) {
    // 3D-styled main shape (natural forms, no glow, no shadow)
    if (type === 'resistor') {
        // Capsule body
        drawEllipse(x + size / 2, y + size / 2, size * 0.4, size * 0.22, [0.8, 0.7, 0.2, 1]);
        // Bands
        drawEllipse(x + size * 0.35, y + size / 2, size * 0.04, size * 0.22, [0.7, 0.3, 0.1, 1]);
        drawEllipse(x + size * 0.5, y + size / 2, size * 0.04, size * 0.22, [0.2, 0.2, 0.2, 1]);
        drawEllipse(x + size * 0.65, y + size / 2, size * 0.04, size * 0.22, [0.7, 0.3, 0.1, 1]);
        // Pins
        drawRect(x + size * 0.12, y + size * 0.46, size * 0.08, size * 0.08, [0.7, 0.7, 0.7, 1]);
        drawRect(x + size * 0.8, y + size * 0.46, size * 0.08, size * 0.08, [0.7, 0.7, 0.7, 1]);
    } else if (type === 'capacitor') {
        drawEllipse(x + size / 2, y + size * 0.45, size * 0.18, size * 0.28, [0.2, 0.6, 1, 1]);
        drawEllipse(x + size / 2, y + size * 0.35, size * 0.08, size * 0.08, [0.7, 0.9, 1, 0.18]);
        drawRect(x + size * 0.48, y + size * 0.7, size * 0.04, size * 0.18, [0.7, 0.7, 0.7, 1]);
    } else if (type === 'diode') {
        drawEllipse(x + size / 2, y + size / 2, size * 0.32, size * 0.16, [1, 0.2, 0.2, 1]);
        drawEllipse(x + size * 0.68, y + size / 2, size * 0.04, size * 0.16, [0.9, 0.9, 0.9, 1]);
        drawRect(x + size * 0.16, y + size * 0.46, size * 0.08, size * 0.08, [0.7, 0.7, 0.7, 1]);
        drawRect(x + size * 0.76, y + size * 0.46, size * 0.08, size * 0.08, [0.7, 0.7, 0.7, 1]);
    } else if (type === 'transistor') {
        drawEllipse(x + size / 2, y + size * 0.45, size * 0.18, size * 0.18, [0.7, 0.2, 1, 1]);
        drawRect(x + size * 0.48, y + size * 0.68, size * 0.04, size * 0.16, [0.7, 0.7, 0.7, 1]);
        drawRect(x + size * 0.38, y + size * 0.68, size * 0.04, size * 0.16, [0.7, 0.7, 0.7, 1]);
        drawRect(x + size * 0.58, y + size * 0.68, size * 0.04, size * 0.16, [0.7, 0.7, 0.7, 1]);
    } else if (type === 'ic') {
        drawRect(x + size * 0.22, y + size * 0.22, size * 0.56, size * 0.36, [0.1, 0.1, 0.1, 1]);
        for (let i = 0; i < 4; ++i) {
            drawRect(x + size * (0.22 + i * 0.14), y + size * 0.16, size * 0.04, size * 0.06, [0.7, 0.7, 0.7, 1]);
            drawRect(x + size * (0.22 + i * 0.14), y + size * 0.72, size * 0.04, size * 0.06, [0.7, 0.7, 0.7, 1]);
        }
    } else if (type === 'led') {
        drawEllipse(x + size / 2, y + size * 0.38, size * 0.12, size * 0.18, [1, 0.2, 0.2, 1]);
        drawEllipse(x + size / 2, y + size * 0.32, size * 0.06, size * 0.06, [1, 0.7, 0.7, 0.18]);
        drawRect(x + size * 0.48, y + size * 0.68, size * 0.04, size * 0.16, [0.7, 0.7, 0.7, 1]);
    } else if (type === 'button') {
        drawEllipse(x + size / 2, y + size * 0.5, size * 0.18, size * 0.18, [0.7, 0.7, 0.7, 1]);
        drawEllipse(x + size / 2, y + size * 0.5, size * 0.10, size * 0.10, [0.2, 0.2, 0.2, 1]);
        drawRect(x + size * 0.38, y + size * 0.68, size * 0.04, size * 0.12, [0.7, 0.3, 0.1, 1]);
        drawRect(x + size * 0.58, y + size * 0.68, size * 0.04, size * 0.12, [0.7, 0.3, 0.1, 1]);
    }
    // Subtle highlight on top
    drawEllipse(x + size / 2, y + size * (highlightY + 0.04), size * 0.28, size * 0.04, [1, 1, 1, 0.13]);
}

// --- Rendering (placeholder, not real WebGL yet) ---
function render(ts) {
    renderBackground(ts / 1000 + (new Date().getHours() + new Date().getMinutes() / 60));
    updateCamera();
    smoothSnake();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.13, 0.13, 0.13, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // Camera offset
    const offsetX = Math.floor(canvas.width / 2 - camera.x * CELL_SIZE);
    const offsetY = Math.floor(canvas.height / 2 - camera.y * CELL_SIZE);
    // Draw glowing signal line for snake
    for (let i = 0; i < renderSnake.length - 1; ++i) {
        const a = renderSnake[i];
        const b = renderSnake[i + 1];
        drawGlowLine(
            offsetX + a.fx * CELL_SIZE + CELL_SIZE / 2,
            offsetY + a.fy * CELL_SIZE + CELL_SIZE / 2,
            offsetX + b.fx * CELL_SIZE + CELL_SIZE / 2,
            offsetY + b.fy * CELL_SIZE + CELL_SIZE / 2,
            [1, 0.8, 0.2], 6
        );
    }
    // Draw head as a pulsing glowing segment with moving highlight
    if (renderSnake.length > 0) {
        const head = renderSnake[0];
        const pulse = 0.7 + 0.3 * Math.sin(ts * 0.01);
        drawRect(
            offsetX + head.fx * CELL_SIZE + CELL_SIZE * (0.2 - 0.1 * pulse),
            offsetY + head.fy * CELL_SIZE + CELL_SIZE * (0.2 - 0.1 * pulse),
            CELL_SIZE * (0.6 + 0.2 * pulse), CELL_SIZE * (0.6 + 0.2 * pulse),
            [1, 0.95, 0.4, 0.7 + 0.3 * pulse]
        );
        // Moving highlight
        let highlightY = 0.18 + 0.08 * Math.sin(ts * 0.02);
        drawRect(
            offsetX + head.fx * CELL_SIZE + CELL_SIZE * 0.18,
            offsetY + head.fy * CELL_SIZE + CELL_SIZE * highlightY,
            CELL_SIZE * 0.64, CELL_SIZE * 0.08,
            [1, 1, 1, 0.18]
        );
        // Spark effect
        if (sparkTimer > 0) {
            for (let i = 0; i < 16; ++i) {
                const angle = (Math.PI * 2 * i) / 16 + ts * 0.02;
                const len = CELL_SIZE * (0.4 + 0.3 * Math.random());
                const color = [1, 0.9 + 0.1 * Math.random(), 0.3 + 0.2 * Math.random()];
                drawGlowLine(
                    offsetX + head.fx * CELL_SIZE + CELL_SIZE / 2,
                    offsetY + head.fy * CELL_SIZE + CELL_SIZE / 2,
                    offsetX + head.fx * CELL_SIZE + CELL_SIZE / 2 + Math.cos(angle) * len,
                    offsetY + head.fy * CELL_SIZE + CELL_SIZE / 2 + Math.sin(angle) * len,
                    color, 4 * (1 - sparkTimer / 18)
                );
            }
            sparkTimer--;
        }
    }
    // Draw stacked components on snake
    for (let i = 0; i < renderSnake.length; ++i) {
        drawComponentShape(
            snake[i]?.type || 'resistor',
            offsetX + renderSnake[i].fx * CELL_SIZE,
            offsetY + renderSnake[i].fy * CELL_SIZE,
            CELL_SIZE
        );
    }
    // Draw component (consumable)
    drawComponentShape(
        nextComponent,
        offsetX + componentPos.x * CELL_SIZE,
        offsetY + componentPos.y * CELL_SIZE,
        CELL_SIZE
    );
}

// --- Main Loop ---
function loop(ts) {
    if (gameOver) return;
    if (!lastUpdate || ts - lastUpdate > speed) {
        moveSnake();
        lastUpdate = ts;
    }
    garbageCollectComponent();
    render(ts);
    requestAnimationFrame(loop);
}

// Initialize renderSnake
renderSnake = snake.map(s => ({...s, fx: s.x, fy: s.y}));

requestAnimationFrame(loop);

function updateCamera() {
    // Calculate visible bounds in grid coordinates
    const halfW = Math.floor(canvas.width / (2 * CELL_SIZE));
    const halfH = Math.floor(canvas.height / (2 * CELL_SIZE));
    const minX = camera.x - halfW;
    const maxX = camera.x + halfW;
    const minY = camera.y - halfH;
    const maxY = camera.y + halfH;
    const head = snake[0];
    // If head is outside the visible area, move cameraTarget to head
    if (head.x < minX || head.x > maxX || head.y < minY || head.y > maxY) {
        cameraTarget.x = head.x;
        cameraTarget.y = head.y;
    }
    // Lerp camera towards cameraTarget
    camera.x += (cameraTarget.x - camera.x) * CAMERA_LERP;
    camera.y += (cameraTarget.y - camera.y) * CAMERA_LERP;
    // Snap if very close
    if (Math.abs(camera.x - cameraTarget.x) < 0.01) camera.x = cameraTarget.x;
    if (Math.abs(camera.y - cameraTarget.y) < 0.01) camera.y = cameraTarget.y;
}
});
