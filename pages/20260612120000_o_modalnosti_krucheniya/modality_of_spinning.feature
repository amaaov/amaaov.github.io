# On the Modality of Spinning
# Limits and Transformations of Siteswap when Applied to Flexible Props
# Boris Fontanov · 2025 · amaaov.github.io

Feature: Modality of Spinning
  Siteswap limits when applied to flexible and torque-based props.

  Scenario: Abstract limits of Siteswap on flexible props
    Given Siteswap is a rhythmic juggling notation
    And Siteswap records object order at an interaction point
    When Siteswap is applied to flexible torque-based props
    Then dwell time must be represented in the notation
    And spatial specificity must be represented in the notation
    But without them Siteswap stays precise for rigid objects
    And Siteswap is insufficient for poi and mixed ensembles

  Rule: Siteswap as an abstract model

    Background:
      Given a Siteswap definition

    Example: Rhythmic order at interaction point
      Then Siteswap records how many beats after the current moment each object must be used again

    Example: Omitted physical detail
      Then Siteswap does not describe trajectory
      And Siteswap does not describe spatial configuration
      And Siteswap does not describe physical characteristics of performance

    Example: Rigid prop assumption
      Given rigid props
      When primary movement is throw followed by catch
      Then the Siteswap assumption holds

  Rule: Dwell time and continuous dynamics

  Scenario: Dwell time is omitted from notation
    Given poi props with continuous dynamics
    When Siteswap is used without dwell time
    Then fundamental discrepancies arise
    And rhythm and movement structure are under-specified

    Scenario: Classical juggling dwell time
      Given classical juggling
      When dwell time is one-third of a beat
      Then the pattern remains valid
      When dwell time is half a beat
      Then the pattern remains valid

    Scenario: Poi hold and transfer
      Given poi props
      Then hold is not a discrete event
      And transfer is not a discrete event
      And movement involves impulse transfer sustaining rotation and plane control
      And traditional notation omits the sustaining movement phase

  Rule: Loss of descriptive precision

    Scenario: Pattern 3 maps to many poi forms
      Given Siteswap pattern "3"
      When interpreted as juggling
      Then throws alternate evenly between hands
      When interpreted as poi spinning
      Then the form may be a wall-plane spiral
      And the form may be an asymmetric weave
      And the form may be a pendulum with active correction
      And all forms preserve the same rhythmic structure

    Scenario: Pattern 5223 in poi
      Given Siteswap pattern "5223"
      Then in juggling it alternates high holding and medium throws
      And in poi digit "2" is an active rotation phase
      And in poi digit "5" is an intensified acceleration

  Rule: Terminology and the cascade

    Scenario: Notation records timing not form
      Given Siteswap notation
      Then it records when the next interaction should occur
      But it does not record what happens between interactions
      And it does not record by what means interaction happens

    Scenario: Cascade has no poi equivalent
      Given the cascade notion from classical juggling
      When applied to poi by analogy
      Then there is no direct equivalent in poi

    Scenario: No cascade in poi
      Given poi props
      And throw is not a discrete event
      And trajectory is continuous
      And torque influences movement
      Then exact reproduction of cascade structure is impossible
      And the claim "there is no cascade in poi" denies form transfer not rhythmic analogue

  Rule: Group synchronisation

    Scenario: Mixed ensemble with pattern 3
      Given a juggler with balls performing pattern "3" as a cascade
      And a poi spinner performing pattern "3" with the same rhythm
      When bodily kinematics are compared
      Then the performers execute fundamentally different actions
      But the notation agrees formally

    Scenario: Semantic divergence without parameters
      Given performers with different prop types
      And hold method is unspecified
      And rotation direction is unspecified
      And plane is unspecified
      And acceleration character is unspecified
      Then semantic divergence arises despite formal notational agreement

  Rule: Conclusion

    Scenario: Siteswap is not universal
      Given Siteswap as an abstraction
      Then it is not a universal system for describing movement
      And flexible torque-based systems require extended models or a limited domain

    Scenario: Siteswap as ordering tool
      Given Siteswap in its current form
      Then it performs communicative and rhythmic function
      But it cannot be the sole descriptor for continuous phase-dependent movement
      And it tells when the next interaction should occur
      And it leaves open how that interaction is realised
