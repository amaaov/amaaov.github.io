# frozen_string_literal: true

# On the Modality of Spinning
# Limits and Transformations of Siteswap when Applied to Flexible Props
# Boris Fontanov · 2025 · amaaov.github.io

module ModalityOfSpinning
  AUTHOR = "Boris Fontanov"
  YEAR = 2025
  PUBLISHER = "amaaov.github.io"

  # abstract
  ABSTRACT = <<~TEXT.strip
    This article examines the limits of siteswap—a rhythmic juggling notation—when applied
    to flexible and torque-based props. Without dwell_time and spatial specificity the notation
    stays precise for rigid objects but is insufficient for poi and mixed ensembles.
  TEXT

  Prop = Data.define(:kind) do
    def rigid? = kind == :rigid
    def poi? = kind == :poi
    def flexible? = poi? || kind == :flexible
    def torque_based? = flexible?
  end

  Rigid = Prop.new(kind: :rigid)
  Poi = Prop.new(kind: :poi)

  class InsufficientNotation < StandardError; end

  class Siteswap
    attr_reader :pattern, :dwell_time, :spatial

    def initialize(pattern, dwell_time: nil, spatial: nil)
      @pattern = pattern.to_s
      @dwell_time = dwell_time
      @spatial = spatial
    end

    def beat_intervals = pattern.chars.map(&:to_i)
    def describes_trajectory? = false
    def describes_spatial_configuration? = !spatial.nil?
    def includes_dwell_time? = !dwell_time.nil?

    def sufficient_for?(prop)
      return true if prop.rigid?

      includes_dwell_time? && describes_spatial_configuration?
    end

    def apply!(prop)
      return self if sufficient_for?(prop)

      raise InsufficientNotation,
            "siteswap lacks dwell_time and spatial specificity for #{prop.kind}"
    end

    def next_interaction_beat(_object_index, _current_beat)
      beat_intervals.first
    end
  end

  # § 1 — Siteswap as an Abstract Model
  module Section1
    DEFINITION = <<~TEXT.strip
      Siteswap is an abstract model of juggling notation that records the rhythmic order
      in which objects appear at a point of interaction. It specifies how many beats after
      the current moment a given object must be used again.
    TEXT

    LIMITATIONS = <<~TEXT.strip
      Siteswap does not describe trajectory, spatial configuration, or physical characteristics
      of performance. It functions as a rhythmic scheme stripped of spatial specificity and
      kinetic detail.
    TEXT

    RIGID_ASSUMPTION = <<~TEXT.strip
      This assumption holds for traditional juggling with rigid props, where movement reduces
      to throw followed by catch.
    TEXT
  end

  class ClassicalJuggling
    def dwell_time_affects_rhythm? = false

    def allowed_dwell_fractions = [Rational(1, 3), Rational(1, 2)]

  # § 2 — observation 2.1
    OBSERVATION_2_1 = <<~TEXT.strip
      In classical juggling, dwell_time is inertial state that does not affect basic rhythm:
      an object may remain in the hand for one-third or half a beat without invalidating the pattern.
    TEXT
  end

  class PoiDynamics
    def discrete_throw_catch? = false
    def continuous_hold_transfer? = true
    def phases = %i[impulse_transfer sustain_rotation plane_control]

  # § 2
    CONTINUOUS_DYNAMICS = <<~TEXT.strip
      With poi, hold and transfer are not discrete events but continuous bodily action. Emphasis
      shifts from release to sustaining movement, which traditional notation omits.
    TEXT
  end

  # § 3 — Loss of Descriptive Precision
  module Section3
    PRECISION_LOSS = <<~TEXT.strip
      Siteswap loses descriptive precision, remaining a scheme of events detached from physical context.
    TEXT

    EXAMPLE_3_1 = {
      pattern: "3",
      juggling: "even alternation of throws between hands",
      poi_forms: %i[wall_plane_spiral asymmetric_weave pendulum_with_correction]
    }.freeze

    PATTERN_5223 = {
      siteswap: "alternation of high, holding, and medium throws",
      poi: { "2" => :active_rotation_phase, "5" => :intensified_acceleration }
    }.freeze
  end

  # § 4 — Terminology and the Cascade
  module Cascade
    NO_POI_EQUIVALENT = <<~TEXT.strip
      The notion of cascade is applied by analogy yet has no direct equivalent in poi.
    TEXT

    PROPOSITION_4_1 = <<~TEXT.strip
      Absence of throw as discrete event, continuity of trajectory, and influence of torque make
      exact reproduction of cascade structure impossible. "There is no cascade in poi" reflects
      impossibility of transferring form without distortion, not denial of rhythmic analogue.
    TEXT

    def self.reproducible_in?(prop)
      case prop
      in Prop[kind: :rigid] then true
      in Prop[kind: :poi] then false
      else false
      end
    end
  end

  Performer = Data.define(:prop, :pattern, :kinematics)

  # § 5 — Group Synchronisation
  Ensemble = Data.define(:performers, :parameters) do
    def same_rhythm? = performers.map(&:pattern).uniq.length == 1

    def semantic_divergence? = performers.map(&:kinematics).uniq.length > 1

    def formally_agreed? = same_rhythm? && semantic_divergence?

  # scenario 5.1
    SCENARIO_5_1 = [
      Performer.new(prop: Rigid, pattern: "3", kinematics: :cascade),
      Performer.new(prop: Poi, pattern: "3", kinematics: :weave)
    ].freeze
  end

  # § 6 — Conclusion
  def self.conclusion
    {
      universal: false,
      communicative: true,
      ordering_tool: true,
      sole_descriptor_for_continuous_movement: false,
      summary: <<~TEXT.strip
        Siteswap tells the performer when the next interaction should occur but leaves open how
        that act is realised—valuable as rhythmic grid, limited where throw and spin blur.
      TEXT
    }
  end
end
