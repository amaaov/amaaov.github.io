# Trainer — Circle Ear Drill

## Overview

Browser ear-training drill on the circle of fifths. The app prompts a root
note, then expects the related answer for the selected interval mode.

## Features

- Modes: Fifths, Fourths, Thirds, Tritones, Random
- Inputs: Keyboard (click/piano keys), MIDI note-on, Microphone pitch
- Score and streak feedback
- Circle-of-fifths answer surface

## Controls

- **Play / Stop**: start or end the drill
- **Mode select**: relation to practice
- **Input select**: Keyboard, MIDI, or Microphone
- **Circle buttons / A–J piano keys**: submit an answer note

## Acceptance

```gherkin
Feature: Circle ear drill

  Scenario: Load trainer
    Given I open demo/trainer/index.html
    Then I see the circle of fifths and trainer controls

  Scenario: Start a round
    When I press Play
    Then a prompt note is shown and sounded
    And an expected answer note is prepared

  Scenario: Correct keyboard answer
    Given a round is awaiting an answer
    When I click the expected note on the circle
    Then the score increases
    And a new round begins

  Scenario: Wrong answer
    Given a round is awaiting an answer
    When I click a different note
    Then the score decreases
    And the expected note is highlighted
```
