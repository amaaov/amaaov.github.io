# RUNNING ENTROPY

An interactive WebGL demoscene experience featuring multiple scenes with dynamic visual effects, particle systems, and geometric patterns.

## 🌋 Features

### Scene System
- **Entropy Magma Scene**: Interactive attractor system with drag distortion
- **Geometric Entropy Scene**: Abstract geometric patterns and mathematical visualizations
- **Particle Entropy Scene**: Dynamic particle systems with physics and trails

### Interactive Elements
- Mouse/touch input for creating attractors
- Real-time field distortion through dragging
- Gamepad support for navigation
- Scene transitions and sequencing

### Visual Effects
- Full-spectrum color gradients using HSV color space
- Fractal Brownian motion for organic movement
- Bloom effects and glow systems
- Dynamic shader updates per scene

## 🎮 Controls

### Navigation
- **Arrow Keys**: Navigate between scenes
- **1, 2, 3**: Jump to specific scenes
- **Space**: Next scene
- **Gamepad A/B**: Scene navigation

### Display
- **I**: Toggle scene information
- **S**: Toggle statistics overlay
- **F**: Toggle fullscreen mode

### Interaction
- **Mouse/Touch**: Add attractor points
- **Drag**: Distort the visual field
- **Gamepad**: A/B buttons for navigation

## 🏗️ Architecture

### Scene-Based System
```
js/scenes/
├── Scene.js              # Base scene class
├── SceneManager.js       # Scene orchestration
├── EntropyMagmaScene.js  # Original entropy magma
├── GeometricEntropyScene.js # Geometric patterns
└── ParticleEntropyScene.js  # Particle systems
```

### Core Components
- **WebGLRenderer**: Dynamic shader management
- **InputManager**: Multi-input handling
- **GamepadHandler**: Gamepad support
- **SceneManager**: Scene sequencing and transitions

### Scene Lifecycle
1. **Initialize**: Set up scene resources
2. **Update**: Handle logic and animations
3. **Render**: Draw with scene-specific shaders
4. **Cleanup**: Release resources

## 🚀 Getting Started

### Prerequisites
- Modern web browser with WebGL 2.0 support
- JavaScript enabled

### Installation
1. Clone the repository
2. Open `index.html` in a web browser
3. Or use a local server for development

### Development
```bash
# Start a local server
npx serve .

# Open in browser
http://localhost:8000
```

## 🎨 Scene Details

### Entropy Magma Scene (3 minutes)
- Interactive attractor system with 20 custom points
- Built-in animated attractors with complex orbits
- Real-time drag distortion effects
- Full-spectrum color mapping

### Geometric Entropy Scene (2.5 minutes)
- Voronoi, Delaunay, fractal, and tessellation patterns
- Morphing between geometric types
- Dynamic color palettes
- Mathematical visualizations

### Particle Entropy Scene (2 minutes)
- 500+ particles with physics simulation
- Trail effects and bloom
- Multiple emitters with varying rates
- Wind, gravity, and turbulence effects

## 🔧 Technical Specifications

### WebGL Features
- WebGL 2.0 with ES 3.0 shaders
- Dynamic shader compilation
- Uniform management system
- Full-screen quad rendering

### Performance
- 60 FPS target on modern hardware
- Efficient particle systems
- Optimized shader uniforms
- Mobile-friendly touch handling

### Browser Support
- Chrome 51+
- Firefox 51+
- Safari 10+
- Edge 79+

## 📱 Mobile Support

- Touch input for attractors and distortion
- Responsive UI overlays
- Optimized for mobile performance
- Full-screen canvas support

## 🎭 Demoscene Aesthetic

The project embraces demoscene traditions with:
- **Retro-futuristic** visual style
- **Mathematical** beauty and complexity
- **Interactive** participation
- **Sequenced** scene progression
- **Full-spectrum** color palettes

## 🔮 Future Enhancements

- Audio-reactive visualizations
- More geometric patterns
- Advanced particle behaviors
- Scene transition effects
- Export/sharing capabilities

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

---

*RUNNING ENTROPY - Where chaos meets beauty in the digital realm* 🌋✨
