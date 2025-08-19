# RUNNING ENTROPY — Specification

## Overview

RUNNING ENTROPY is a web-based, interactive demoscene experience featuring multiple sequenced scenes with dynamic visual effects, particle systems, and geometric patterns. The application combines autonomous, oscillating, full-spectrum color flow with interactive elements across three distinct scenes, creating a participatory entropy field where users can navigate through different visual realms and interact with each scene's unique characteristics.

## Scene Architecture

### Scene System
The application uses a modular scene-based architecture with the following components:

- **SceneManager**: Orchestrates scene sequencing, transitions, and lifecycle management
- **Base Scene Class**: Common interface for all scenes with timing and input handling
- **Individual Scenes**: Each scene implements its own visual effects and interactions

### Scene Sequence
1. **Entropy Magma Scene** (3 minutes) - Interactive attractor system with drag distortion
2. **Geometric Entropy Scene** (2.5 minutes) - Abstract geometric patterns and mathematical visualizations
3. **Particle Entropy Scene** (2 minutes) - Dynamic particle systems with physics and trails

### Scene Lifecycle
Each scene follows a standardized lifecycle:
1. **Initialize**: Set up scene resources and state
2. **Update**: Handle logic, animations, and input processing
3. **Render**: Draw with scene-specific shaders and effects
4. **Cleanup**: Release resources when transitioning

## Scene Details

### Entropy Magma Scene
**Duration**: 3 minutes
**Features**:
- Interactive attractor system with up to 20 custom points
- Built-in animated attractors with complex orbital patterns (circular, figure-8, spiral, lemniscate, complex)
- Real-time drag distortion effects
- Full-spectrum color mapping using HSV color space
- Fractal Brownian motion for organic fluid movement
- Physics-based attractor behavior with bouncing and life systems

**Interaction**:
- Click/touch to add attractor points
- Drag to distort the color field
- Attractors have velocity, bounce off edges, and fade over time

### Geometric Entropy Scene
**Duration**: 2.5 minutes
**Features**:
- Multiple geometric pattern types: Voronoi, Delaunay, fractals, tessellation
- Morphing between different geometric algorithms
- Dynamic color palettes with 5 distinct color schemes
- Mathematical visualizations with rotation, scaling, and distortion
- Organic noise integration for natural feel

**Pattern Types**:
- **Voronoi**: Cell-based patterns with animated boundaries
- **Delaunay**: Triangulation-based geometric structures
- **Fractals**: Multi-layered mathematical patterns
- **Tessellation**: Repeating geometric tile patterns

### Particle Entropy Scene
**Duration**: 2 minutes
**Features**:
- 500+ particles with full physics simulation
- Multiple emitters with varying rates and positions
- Trail effects with configurable length and fade
- Bloom effects and glow systems
- Wind, gravity, and turbulence physics
- Dynamic emitter animation

**Physics Parameters**:
- Gravity vector with configurable strength
- Wind forces with time-based variation
- Turbulence for chaotic movement
- Particle lifetime and size variation
- Edge bouncing with energy loss

## Technical Architecture

### WebGL Renderer
- **WebGL 2.0** with ES 3.0 shaders
- Dynamic shader compilation and updates
- Uniform management system for scene-specific parameters
- Full-screen quad rendering with proper aspect ratio handling
- Efficient resource management and cleanup

### Input System
- **Multi-input support**: Mouse, touch, keyboard, gamepad
- **Input state management**: Centralized input state passed to scenes
- **Gamepad support**: A/B buttons for navigation, analog stick support
- **Touch optimization**: Mobile-friendly touch handling

### Scene Management
- **Sequencer**: Visual progress bar with interactive scene markers
- **Development mode**: Single scene testing without auto-transitions
- **Scene navigation**: Manual and automatic scene progression
- **Resource management**: Proper cleanup and memory management

## User Interface

### Sequencer Progress Bar
- **Visual progress**: Shows overall sequence progress
- **Interactive markers**: Click to jump to any scene
- **Scene information**: Tooltips with scene names and durations
- **Active indicator**: Highlights current scene marker
- **Toggle visibility**: Press 'Q' to show/hide sequencer

### Scene Information Overlay
- **Current scene**: Displays active scene name
- **Progress tracking**: Shows scene progress and timing
- **Sequence position**: Indicates scene number in sequence
- **Toggle**: Press 'I' to show/hide

### Statistics Overlay
- **Performance metrics**: FPS, frame count, timing
- **Scene data**: Current scene information and progress
- **Debug information**: Development mode status
- **Toggle**: Press 'S' to show/hide

### Controls Overlay
- **Navigation controls**: Keyboard shortcuts and gamepad mapping
- **Display options**: UI toggle controls
- **Development tools**: Development mode and sequencer controls
- **Interaction guide**: Input method instructions

## Development Features

### Development Mode
- **Single scene testing**: Test individual scenes in isolation
- **No auto-transition**: Scenes don't automatically progress
- **Visual indicator**: Orange pulsing indicator when active
- **Toggle**: Press 'D' to enable/disable for current scene
- **Console commands**: Direct API access for testing

**Usage**:
```javascript
// Enable development mode for specific scene
sceneManager.enableDevelopmentMode('entropy_magma');

// Disable development mode
sceneManager.disableDevelopmentMode();

// Check development mode status
sceneManager.getSceneInfo();
```

### Scene Navigation
- **Arrow keys**: Navigate between scenes
- **Number keys**: Jump to specific scenes (1, 2, 3)
- **Space bar**: Next scene
- **Sequencer clicks**: Direct scene jumping
- **Gamepad**: A/B buttons for navigation

### Debug Tools
- **Console logging**: Comprehensive scene lifecycle logging
- **Performance monitoring**: FPS and timing statistics
- **Scene information**: Detailed scene state and parameters
- **Error handling**: Graceful error recovery and reporting

## Visual Effects

### Color Systems
- **HSV color space**: Full-spectrum color mapping
- **Dynamic palettes**: Scene-specific color schemes
- **Gradient systems**: Smooth color transitions and blending
- **Glow effects**: Bloom and light emission systems

### Animation Systems
- **Time-based animation**: Smooth parameter evolution
- **Physics simulation**: Realistic particle and attractor behavior
- **Morphing effects**: Smooth transitions between visual states
- **Oscillation**: Breathing and pulsing effects

### Shader Features
- **Fractal noise**: Organic, natural movement patterns
- **Geometric algorithms**: Mathematical pattern generation
- **Particle systems**: Efficient GPU-based particle rendering
- **Post-processing**: Bloom, vignette, and atmospheric effects

## Performance Considerations

### Optimization Strategies
- **Efficient shaders**: Optimized GLSL code for performance
- **Particle limits**: Configurable particle counts for different hardware
- **LOD systems**: Level-of-detail adjustments for mobile devices
- **Memory management**: Proper resource cleanup and reuse

### Target Performance
- **60 FPS**: Target frame rate on modern hardware
- **Mobile optimization**: Touch-friendly controls and performance
- **Scalable effects**: Adjustable quality settings
- **Graceful degradation**: Fallbacks for older hardware

## Browser Compatibility

### WebGL Support
- **WebGL 2.0**: Required for advanced shader features
- **ES 3.0 shaders**: Modern shader language support
- **Float textures**: High-precision rendering
- **Multiple render targets**: Advanced rendering techniques

### Browser Requirements
- **Chrome 51+**: Full feature support
- **Firefox 51+**: Full feature support
- **Safari 10+**: Full feature support
- **Edge 79+**: Full feature support

## Mobile Support

### Touch Interface
- **Touch input**: Attractor creation and field distortion
- **Responsive UI**: Adaptive overlay positioning
- **Performance optimization**: Mobile-specific rendering settings
- **Full-screen support**: Immersive mobile experience

### Mobile Considerations
- **Battery optimization**: Efficient rendering for mobile devices
- **Touch precision**: Optimized touch target sizes
- **Orientation support**: Landscape and portrait modes
- **Performance scaling**: Automatic quality adjustments

## Future Enhancements

### Planned Features
- **Audio reactivity**: Sound-driven visual effects
- **More scenes**: Additional geometric and particle scenes
- **Advanced transitions**: Scene-to-scene transition effects
- **Export capabilities**: Screenshot and video export
- **Social features**: Sharing and collaboration tools

### Technical Improvements
- **WebGPU support**: Next-generation graphics API
- **Advanced physics**: More complex particle behaviors
- **AI integration**: Procedural content generation
- **VR support**: Immersive virtual reality experience

## File Structure

```
running_entropy/
├── index.html              # Main HTML file
├── css/
│   └── style.css           # Main stylesheet with UI components
├── js/
│   ├── app.js              # Main application controller
│   ├── webgl-renderer.js   # WebGL rendering system
│   ├── input-manager.js    # Input handling system
│   ├── gamepad-handler.js  # Gamepad support
│   ├── noise-generator.js  # Noise generation utilities
│   ├── utils.js            # Utility functions
│   └── scenes/
│       ├── Scene.js        # Base scene class
│       ├── SceneManager.js # Scene orchestration
│       ├── EntropyMagmaScene.js    # Entropy magma scene
│       ├── GeometricEntropyScene.js # Geometric patterns scene
│       └── ParticleEntropyScene.js  # Particle systems scene
├── README.md               # Project documentation
├── SPECIFICATION.md        # This specification
└── test.html              # Development test file
```

## Changelog

- **2024-12**: Complete scene-based architecture overhaul with SceneManager, three distinct scenes, sequencer progress bar, development mode, and comprehensive UI system
- **2024-12**: Added interactive sequencer with scene markers and development tools
- **2024-12**: Implemented geometric entropy scene with multiple pattern types
- **2024-12**: Created particle entropy scene with physics simulation
- **2024-12**: Enhanced WebGL renderer with dynamic shader support
- **2024-12**: Added comprehensive mobile support and responsive UI
- **2024-06**: Original interactive attractor system with entropy magma effects
