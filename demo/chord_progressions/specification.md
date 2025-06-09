# Chord Progressions Web Application Specification

## Overview
An interactive web application for exploring and playing chord progressions with advanced audio synthesis capabilities.

## Core Features

### 1. Chord Visualization
- Hexagonal layout for chord display
- Dynamic chord generation based on selected root note and scale
- Visual feedback for playing and upcoming chords
- Smooth transitions and animations

### 2. Audio System
- Web Audio API-based synthesis
- Multiple oscillator types (sine, triangle, square, sawtooth)
- Rich sound design with detuning and stereo spread
- Advanced mixing architecture:
  - Instrument channels:
    - Chords channel (mid-high emphasis, integrated noise generator)
    - Arpeggiator channel (mid-high emphasis)
    - Bass channel (low-end focus)
  - Effects chain (serial processing):
    - Delay mixer (first in chain)
    - Reverb mixer (second in chain)
  - Master channel with precision limiter

- Signal Flow and Gain Staging:
  1. Instrument Stage:
     - Individual oscillators mixed at -3dB headroom
     - Integrated noise generator with envelope following
     - Per-channel EQ for frequency shaping
     - Pan control for stereo image
  2. Effects Processing Stage:
     - Delay processing (-3dB input)
       - Independent wet/dry mix
       - Feedback control
       - Time sync with BPM
     - Reverb processing (-4dB input)
       - Independent wet/dry mix
       - Decay time control
       - Pre-delay and diffusion
  3. Final Stage:
     - Master input gain (-1dB headroom)
     - Precision limiting (2:1 soft knee)
     - Final output control (-1dB safety margin)

- Synth Features:
  - Multiple oscillator types per voice
  - Noise generator integrated into synth voices
  - Envelope control (ADSR) affecting both oscillators and noise
  - Glide/portamento control
  - Stereo width control

- Noise Features:
  - Multiple noise types (white, pink, brown)
  - Envelope following main synth
  - Independent level control
  - Filtered through main synth EQ
  - Proper gain staging in mix

- Per-channel features:
  - 3-band parametric EQ
  - Stereo pan control
  - Independent gain staging
  - Effect send controls
- Effects processing:
  - Reverb with adjustable time and decay
  - Delay with feedback and mix control
  - Filter with resonance control
  - LFO-based stereo movement

### 3. Interaction Modes
- Standard Mode:
  - Click/touch to change root note
  - Hover/touch to play chords
  - Real-time parameter adjustment
  - Keyboard controls for chord activation:
    - 3 hexagons: A W D
    - 4 hexagons: A W D S
    - 6 hexagons: A W D S Q E
    - 7 hexagons: A W D S Q E R
    - Keys map to chords in a clockwise pattern starting from the leftmost chord
- FUN Mode:
  - Automatic progression generation
  - Style-based pattern generation (Jazz, Punk, Classical)
  - Smooth transitions between patterns
  - Parameter modulation
  - Bass line generation with jazz/reggae influences

### 4. Sound Controls
- Oscillator settings:
  - Shape selection
  - Detune amount
  - Mix ratio
  - Glide time
- Envelope controls:
  - Attack
  - Decay
  - Sustain
  - Release
- Effect parameters:
  - Reverb time and mix
  - Delay time and feedback
  - Filter cutoff and resonance
  - Pan LFO rate and depth

### 5. Musical Features
- Multiple scale types:
  - Major
  - Minor
  - Dorian
  - Mixolydian
  - Altered
  - Lydian Dominant
  - Half Diminished
- Progression patterns:
  - Free form
  - II-V-I
  - Bird Changes
  - Coltrane Changes
- Advanced chord voicings:
  - Extended harmonies (7th, 9th, 11th, 13th)
  - Altered tensions
  - Voice leading optimization

## Technical Requirements

### 1. Audio Processing
- Sample rate: 44.1kHz
- Bit depth: 32-bit floating point
- Latency: <50ms
- Polyphony: Up to 16 voices

### 2. Performance
- Frame rate: 60 FPS for animations
- Audio scheduling within 2-second window
- Efficient resource cleanup
- Memory leak prevention

### 3. Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile device support
- Touch event handling
- Responsive design

### 4. Code Organization
- Modular architecture:
  - Audio processing modules
  - UI components
  - Event handling
  - State management
  - Utility functions
- ES6+ features
- Clean separation of concerns

### 5. Data Management
- Local storage for settings
- State persistence
- Error handling
- Resource tracking

## User Interface

### 1. Layout
- Centered chord hexagon
- Collapsible control sidebar
- Mobile-responsive design
- Touch-friendly controls

### 2. Visual Feedback
- Active chord highlighting
- Playing state indication
- Parameter value display
- Sequence visualization

### 3. Controls
- Intuitive parameter adjustment
- Clear visual hierarchy
- Consistent interaction patterns
- Immediate feedback

## UI Design Guidelines

### 1. Color Scheme
- Primary: Deep purple (#6200EE)
- Secondary: Electric pink (#FF0080)
- Background: Dark gray (#121212)
- Surface: Light gray (#2D2D2D)
- Text: White (#FFFFFF)
- Accent colors:
  - Positive: Teal (#00B8D4)
  - Sad: Purple (#7C4DFF)
  - Dark: Deep blue (#304FFE)

### 2. Typography
- Primary font: 'Inter', sans-serif
- Monospace font: 'Roboto Mono', monospace
- Font sizes:
  - Headers: 24px/1.5
  - Controls: 14px/1.2
  - Values: 12px/1.0
  - Chord names: 18px/1.0
- Font weights:
  - Headers: 600
  - Controls: 500
  - Values: 400

### 3. Icon Design
- Minimal, geometric SVG icons
- Consistent 24x24px viewport
- 2px stroke width
- Round line caps and joins
- Icon categories:
  - Waveform shapes: Abstract representations of oscillator types
  - Progression patterns: Geometric visualizations of musical movement
  - Scale modes: Vertical bars showing interval relationships
  - Noise types: Varying density dot patterns
  - Control functions: Universal symbols (play, stop, randomize)

### 4. Control Elements

#### Knobs
- Circular design with 270-degree rotation
- Outer ring: 2px stroke with gradient
- Inner fill: Radial gradient
- Indicator line: 2px white stroke
- Size: 48x48px for main controls, 32x32px for secondary
- Hover effect: Subtle glow
- Active state: Brighter gradient and stronger glow

#### Sliders
- Height: 4px
- Track: Linear gradient background
- Thumb: 16x16px circular design
- Thumb hover: Scale to 18x18px with glow
- Value display: Floating label above thumb
- Range markings: Subtle tick marks at key values

#### Buttons
- Standard size: 48x48px (control buttons), 40x40px (root note buttons)
- Border: 2px solid var(--accent-color)
- Border radius: 4px
- Background: transparent (default state)
- Background: var(--accent-color) (active state)
- Text/Icon color: var(--accent-color) (default state)
- Text/Icon color: white (active state)
- Hover effect:
  - Scale: 1.1
  - Background: rgba(44, 62, 80, 0.1)
- Active state:
  - Background: var(--accent-color)
  - Box shadow: 0 2px 8px rgba(0, 0, 0, 0.2)
  - Scale: 1.1
- Spacing: 8px gap between buttons
- Icon size: 24px
- Stroke width: 2px
- Font size: 14px (root notes)

### 5. Hexagon Grid Design

#### Main Hexagon
- Size: Responsive, maximum 600px diameter
- Border: 1px stroke with gradient
- Background: White (#FFFFFF)
- Shadow: Multi-layered with color bleeding
- Animation: Subtle breathing effect

#### Chord Hexagons
- Size: Regular hexagon with equal edges (width:height ratio of 1:1.1547)
- Base size: 104px width, 120px height
- Mobile size: 78px width, 90px height
- Spacing: 20px minimum between edges
- Border: 1px stroke, color-coded by chord function
- Background: Semi-transparent gradients based on chord function
- Text: Non-selectable, centered
- States:
  - Hover: Glow effect and scale transform
  - Active: Brighter background and pulsing animation
  - Playing: Yellow pulsating glow synchronized with ARP BPM
  - Upcoming: Subtle opacity pulsing

#### Root Note Display
- Size: Regular hexagon (87px width, 100px height)
- Mobile size: 69px width, 80px height
- Background: Linear gradient from deep blue to electric blue
- Text: Non-selectable, centered, 2rem size
- Border: 1px stroke with light opacity

#### Connection Lines
- Style: Solid lines with gradient
- Width: 2px
- Opacity: 10%
- Animation: Flow effect in direction of progression
- Highlight: Glow effect for active connections

### 6. Animation Guidelines

#### Transitions
- Duration: 200ms for UI state changes
- Easing: cubic-bezier(0.4, 0, 0.2, 1)
- Scale transforms: From center point
- Color transitions: Through compatible hue paths
- Opacity changes: Linear easing

#### Interactive Feedback
- Button presses: 50ms scale reduction
- Slider movement: Real-time value updates
- Knob rotation: Smooth, lag-free response
- Hover effects: 100ms fade in/out

#### Musical Visualization
- BPM sync: All animations tied to tempo
- Chord pulses: Sync with note triggers
- Pattern animations: Match musical phrase length
- Intensity: Correlate with audio parameters

### 7. Responsive Behavior

#### Breakpoints
- Desktop: > 1200px
- Tablet: 768px - 1199px
- Mobile: < 767px

#### Layout Adjustments
- Sidebar: Collapsible on tablet and mobile
- Hexagon grid: Scales with viewport
- Controls: Stack vertically on mobile
- Spacing: Increases on larger screens

#### Touch Optimization
- Minimum touch target: 44x44px
- Touch feedback: Visual and haptic
- Gesture support: Swipe, pinch, rotate
- Palm rejection: Smart touch detection

### 8. Accessibility

#### Visual Hierarchy
- Clear contrast ratios (minimum 4.5:1)
- Multiple visual cues for state changes
- Consistent use of color meaning
- Focus indicators always visible

#### Interactive Elements
- ARIA labels for all controls
- Role attributes for custom controls
- State management for screen readers
- Keyboard navigation support

## Future Enhancements
- MIDI device support
- Custom chord voicing editor
- Pattern recording and playback
- Additional audio effects
- Scale and chord sugeneration:
  - Walking bass
  - Restions
- Export/import capabilities
- Collaborative features
