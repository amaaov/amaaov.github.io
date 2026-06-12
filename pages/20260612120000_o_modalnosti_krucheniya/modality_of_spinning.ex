defmodule ModalityOfSpinning do
  @author "Boris Fontanov"
  @year 2025
  @publisher "amaaov.github.io"

  @abstract """
  This article examines the limits of siteswap—a rhythmic juggling notation—when applied
  to flexible and torque-based props. Without dwell_time and spatial specificity the notation
  stays precise for rigid objects but is insufficient for poi and mixed ensembles.
  """

  defmodule Prop do
    @enforce_keys [:kind]
    defstruct [:kind]

    def rigid?(%__MODULE__{kind: :rigid}), do: true
    def rigid?(_), do: false

    def poi?(%__MODULE__{kind: :poi}), do: true
    def poi?(_), do: false

    def flexible?(%__MODULE__{kind: kind}) when kind in [:poi, :flexible], do: true
    def flexible?(_), do: false
  end

  defmodule Siteswap do
    @enforce_keys [:pattern]
    defstruct [:pattern, :dwell_time, :spatial]

    def beat_intervals(%__MODULE__{pattern: pattern}) do
      pattern
      |> String.graphemes()
      |> Enum.map(&String.to_integer/1)
    end

    def describes_trajectory?(_), do: false

    def describes_spatial_configuration?(%__MODULE__{spatial: nil}), do: false
    def describes_spatial_configuration?(_), do: true

    def includes_dwell_time?(%__MODULE__{dwell_time: nil}), do: false
    def includes_dwell_time?(_), do: true

    def sufficient_for?(%__MODULE__{}, %Prop{kind: :rigid}), do: true

    def sufficient_for?(%__MODULE__{} = siteswap, _prop) do
      includes_dwell_time?(siteswap) and describes_spatial_configuration?(siteswap)
    end

    def apply!(%__MODULE__{} = siteswap, prop) do
      if sufficient_for?(siteswap, prop) do
        siteswap
      else
        raise __MODULE__.InsufficientNotation,
              "siteswap lacks dwell_time and spatial specificity for #{prop.kind}"
      end
    end

    defmodule InsufficientNotation, do: defexception([:message])
  end

  # § 1 — Siteswap as an Abstract Model
  defmodule Section1 do
    @definition """
    Siteswap is an abstract model of juggling notation that records the rhythmic order
    in which objects appear at a point of interaction. It specifies how many beats after
    the current moment a given object must be used again.
    """

    @limitations """
    Siteswap does not describe trajectory, spatial configuration, or physical characteristics
    of performance. It functions as a rhythmic scheme stripped of spatial specificity and
    kinetic detail.
    """

    @rigid_assumption """
    This assumption holds for traditional juggling with rigid props, where movement reduces
    to throw followed by catch.
    """
  end

  defmodule ClassicalJuggling do
    def dwell_time_affects_rhythm?, do: false

    def allowed_dwell_fractions, do: [1 / 3, 1 / 2]

    @observation_2_1 """
    In classical juggling, dwell_time is inertial state that does not affect basic rhythm:
    an object may remain in the hand for one-third or half a beat without invalidating the pattern.
    """
  end

  defmodule PoiDynamics do
    def discrete_throw_catch?, do: false
    def continuous_hold_transfer?, do: true
    def phases, do: [:impulse_transfer, :sustain_rotation, :plane_control]

    @continuous_dynamics """
    With poi, hold and transfer are not discrete events but continuous bodily action. Emphasis
    shifts from release to sustaining movement, which traditional notation omits.
    """
  end

  # § 3 — Loss of Descriptive Precision
  defmodule Section3 do
    @precision_loss """
    Siteswap loses descriptive precision, remaining a scheme of events detached from physical context.
    """

    @example_3_1 %{
      pattern: "3",
      juggling: "even alternation of throws between hands",
      poi_forms: [:wall_plane_spiral, :asymmetric_weave, :pendulum_with_correction]
    }

    @pattern_5223 %{
      siteswap: "alternation of high, holding, and medium throws",
      poi: %{"2" => :active_rotation_phase, "5" => :intensified_acceleration}
    }
  end

  # § 4 — Terminology and the Cascade
  defmodule Cascade do
    @no_poi_equivalent """
    The notion of cascade is applied by analogy yet has no direct equivalent in poi.
    """

    @proposition_4_1 """
    Absence of throw as discrete event, continuity of trajectory, and influence of torque make
    exact reproduction of cascade structure impossible. "There is no cascade in poi" reflects
    impossibility of transferring form without distortion, not denial of rhythmic analogue.
    """

    def reproducible_in?(%Prop{kind: :rigid}), do: true
    def reproducible_in?(%Prop{kind: :poi}), do: false
    def reproducible_in?(_), do: false
  end

  defmodule Performer do
    @enforce_keys [:prop, :pattern, :kinematics]
    defstruct [:prop, :pattern, :kinematics]
  end

  # § 5 — Group Synchronisation
  defmodule Ensemble do
    @enforce_keys [:performers, :parameters]
    defstruct [:performers, :parameters]

    def same_rhythm?(%__MODULE__{performers: performers}) do
      performers |> Enum.map(& &1.pattern) |> Enum.uniq() |> length() == 1
    end

    def semantic_divergence?(%__MODULE__{performers: performers}) do
      performers |> Enum.map(& &1.kinematics) |> Enum.uniq() |> length() > 1
    end

    def formally_agreed?(ensemble) do
      same_rhythm?(ensemble) and semantic_divergence?(ensemble)
    end

    @scenario_5_1 [
      %Performer{prop: %Prop{kind: :rigid}, pattern: "3", kinematics: :cascade},
      %Performer{prop: %Prop{kind: :poi}, pattern: "3", kinematics: :weave}
    ]
  end

  # § 6 — Conclusion
  def conclusion do
    %{
      universal: false,
      communicative: true,
      ordering_tool: true,
      sole_descriptor_for_continuous_movement: false,
      summary: """
      Siteswap tells the performer when the next interaction should occur but leaves open how
      that act is realised—valuable as rhythmic grid, limited where throw and spin blur.
      """
    }
  end
end
