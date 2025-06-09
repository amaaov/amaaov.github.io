# Chord Progressions Web Application Specification

## Overview

An interactive web application for exploring and playing chord progressions with
advanced audio synthesis capabilities.

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
- Three-channel mixing system:
  - Chords channel with mid-high emphasis
  - Bass channel with low-end focus
  - Master channel with limiter

### 3. Interaction Modes

- Standard Mode:
  - Click/touch to change root note
  - Hover/touch to play chords
  - Real-time parameter adjustment
- FUN Mode:
  - Automatic progression generation
  - Style-based pattern generation
  - Smooth transitions between patterns
  - Parameter modulation
  - Bass line generation

### 4. Sound Controls

- Oscillator settings:
  - Shape selection
  - Detune amount
  - Mix ratio
- Envelope controls:
  - Attack
  - Decay
  - Sustain
  - Release
- Effect parameters:
  - Reverb time and mix
  - Delay time and feedback
  - Filter cutoff and resonance

### 5. Musical Features

- Multiple scale types:
  - Major
  - Minor
  - Dorian
  - Mixolydian
  - Altered
- Progression patterns:
  - Free form
  - II-V-I
  - Jazz Changes
  - Custom Patterns

## UI Design Guidelines

### 1. Color Scheme

- Primary: Deep purple (#6200EE)
- Secondary: Electric pink (#FF0080)
- Background: Dark gray (#121212)
- Surface: Light gray (#2D2D2D)
- Text: White (#FFFFFF)
- Accent colors:
  - Active: Red (#ff3b3b)
  - Hover: Blue-gray (rgba(52, 73, 94, 0.1))
  - Active Background: Dark blue-gray (#1a2634)

### 2. Typography

- System font stack: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
  Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif
- Font sizes:
  - Headers: 1.2rem
  - Controls: 14px
  - Values: 0.7rem
  - Chord names: 1.2rem
- Font weights:
  - Headers: 500
  - Controls: 400
  - Values: 500

### 3. Control Elements

#### Buttons

- Standard size: 40x40px for all control buttons (shape, progression, scale,
  arp, noise)
- Border: 2px solid var(--accent-color)
- Border radius: 4px
- Background: transparent (default state)
- Background: #1a2634 (active state)
- Text/Icon color: var(--accent-color) (default state)
- Text/Icon color: white (active state)
- Icon fill: none (default state)
- Icon fill: var(--active-color) with 0.3 opacity (active state)
- Icon stroke: currentColor
- Icon stroke-width: 2px
- Hover effect:
  - Background: rgba(52, 73, 94, 0.1)
  - No scale transform
- Active state:
  - Background: #1a2634
  - Border-color: #1a2634
  - Icon fill: var(--active-color) with 0.3 opacity
  - Icon stroke: white
- Spacing: 8px gap between buttons
- Icon size: 24x24px
- Font size: 14px (for text buttons)
- Touch target size: 44x44px on touch devices

#### Sliders

- Height: 3px
- Track: #eee background
- Thumb: 16x16px circular design
- Thumb hover: Scale to 1.2 with shadow
- Value display: Right-aligned text
- Background: #eee

### 4. Layout

- Sidebar width: 280px
- Responsive breakpoints:
  - Desktop: 1200px+
  - Tablet: 900px
  - Mobile: 768px and below
- Padding: 1rem (desktop), 0.8rem (tablet), 20px (mobile)
- Gap between elements: 8px
- Button group spacing: 12px margin bottom

### 5. Accessibility

- High contrast mode support
- Reduced motion support
- Focus indicators
- Touch-friendly targets
- Keyboard navigation
- Skip links

### 6. Mobile Optimization

- Collapsible sidebar
- Touch-optimized button sizes
- Safe area insets
- Improved scrolling
- Prevent text selection
- iOS audio compatibility
