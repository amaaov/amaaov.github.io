# Snake: Electrical Components Edition - Specification

## Overview
A WebGL-based Snake game where the snake grows by consuming electrical components (resistors, capacitors, diodes, transistors, etc). The snake visually stacks these components as it grows. The game supports keyboard, Bluetooth joystick/gamepad, mobile touch, and mobile gyro controls. No hint dialogs or overlays are present.

## Features
- Classic Snake gameplay on a grid.
- Each consumed item is a random electrical component, visually stacked in the snake's body.
- Components: resistor, capacitor, diode, transistor (extendable).
- Game over on collision with self or wall.
- Responsive design for desktop and mobile.
- Controls:
  - Keyboard (arrows)
  - Bluetooth joystick/gamepad
  - Mobile touch (swipe)
  - Mobile gyro (tilt)
- No additional dialogs, overlays, or hints.

## Technical
- Uses WebGL for rendering.
- Canvas fills the screen, centered.
- All logic in scripts.js, styles in styles.css.

## Gherkin Acceptance Criteria

```gherkin
Feature: Snake game with electrical components

  Scenario: Starting the game
    Given I open the game in a browser
    Then I see a grid with a snake and an electrical component

  Scenario: Moving the snake with keyboard
    When I press an arrow key
    Then the snake moves in that direction

  Scenario: Moving the snake with joystick
    When I move the joystick
    Then the snake moves in the corresponding direction

  Scenario: Moving the snake with touch
    When I swipe on the screen
    Then the snake moves in the swipe direction

  Scenario: Moving the snake with gyro
    When I tilt my mobile device
    Then the snake moves in the tilt direction

  Scenario: Consuming a component
    Given the snake's head moves onto a component
    Then the snake grows by one segment
    And the new segment is the consumed component type
    And a new component appears elsewhere

  Scenario: Game over on collision
    Given the snake collides with itself or the wall
    Then the game ends

  Scenario: No overlays or hints
    Then there are no dialogs, overlays, or hint popups
```
