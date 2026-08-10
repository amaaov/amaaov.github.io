# Kompone

WebGL snake that grows by eating electrical components (resistors, capacitors,
diodes, transistors, ICs, LEDs, buttons). The body stacks the components it
consumes.

## Controls

- Keyboard: arrow keys; Enter / Space / Escape restart after game over
- Touch: swipe
- Gyro: tilt (mobile)
- Gamepad: left stick

## Technical

- WebGL filled rectangles and ellipse fans for component shapes
- Camera follows the head
- Procedural tiled background

## Acceptance

```gherkin
Feature: Kompone snake

  Scenario: Load game
    Given I open the Kompone page
    Then a WebGL canvas fills the viewport

  Scenario: Move with keyboard
    When I press an arrow key
    Then the snake direction updates

  Scenario: Restart after collision
    Given the snake has collided with itself
    When I press Space
    Then the game resets and the loop resumes
```
