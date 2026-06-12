# frozen_string_literal: true

require_relative "modality_of_spinning"

Before do
  @siteswap = nil
  @prop = nil
end

Given("Siteswap is a rhythmic juggling notation") do
  @siteswap = ModalityOfSpinning::Siteswap.new("3")
end

Given("Siteswap records object order at an interaction point") do
  expect(@siteswap).not_to be_nil
end

When("Siteswap is applied to flexible torque-based props") do
  @prop = ModalityOfSpinning::Poi
end

Then("dwell time must be represented in the notation") do
  expect(@siteswap.includes_dwell_time?).to be false
end

Then("spatial specificity must be represented in the notation") do
  expect(@siteswap.describes_spatial_configuration?).to be false
end

Then("without them Siteswap stays precise for rigid objects") do
  expect(@siteswap.sufficient_for?(ModalityOfSpinning::Rigid)).to be true
end

Then("Siteswap is insufficient for poi and mixed ensembles") do
  expect { @siteswap.apply!(@prop) }.to raise_error(ModalityOfSpinning::InsufficientNotation)
end

Given("a Siteswap definition") do
  @siteswap = ModalityOfSpinning::Siteswap.new("3")
end

Then("Siteswap records how many beats after the current moment each object must be used again") do
  expect(ModalityOfSpinning::Section1::DEFINITION).to include("beats after")
end

Then("Siteswap does not describe trajectory") do
  expect(@siteswap.describes_trajectory?).to be false
end

Then("Siteswap does not describe spatial configuration") do
  expect(@siteswap.describes_spatial_configuration?).to be false
end

Then("Siteswap does not describe physical characteristics of performance") do
  expect(ModalityOfSpinning::Section1::LIMITATIONS).to include("physical characteristics")
end

Given("rigid props") do
  @prop = ModalityOfSpinning::Rigid
end

When("primary movement is throw followed by catch") do
  @movement = %i[throw catch]
end

Then("the Siteswap assumption holds") do
  expect(@siteswap.sufficient_for?(@prop)).to be true
end

Given("poi props with continuous dynamics") do
  @prop = ModalityOfSpinning::Poi
end

When("Siteswap is used without dwell time") do
  @siteswap = ModalityOfSpinning::Siteswap.new("3")
end

Then("fundamental discrepancies arise") do
  expect { @siteswap.apply!(@prop) }.to raise_error(ModalityOfSpinning::InsufficientNotation)
end

Then("rhythm and movement structure are under-specified") do
  expect(ModalityOfSpinning::PoiDynamics.new.continuous_hold_transfer?).to be true
end

Given("classical juggling") do
  @juggling = ModalityOfSpinning::ClassicalJuggling.new
end

When("dwell time is one-third of a beat") do
  @dwell = Rational(1, 3)
end

When("dwell time is half a beat") do
  @dwell = Rational(1, 2)
end

Then("the pattern remains valid") do
  expect(@juggling.allowed_dwell_fractions).to include(@dwell)
end

Given("poi props") do
  @prop = ModalityOfSpinning::Poi
end

Then("hold is not a discrete event") do
  expect(ModalityOfSpinning::PoiDynamics.new.discrete_throw_catch?).to be false
end

Then("transfer is not a discrete event") do
  expect(ModalityOfSpinning::PoiDynamics.new.continuous_hold_transfer?).to be true
end

Then("movement involves impulse transfer sustaining rotation and plane control") do
  expect(ModalityOfSpinning::PoiDynamics.new.phases).to eq(
    %i[impulse_transfer sustain_rotation plane_control]
  )
end

Then("traditional notation omits the sustaining movement phase") do
  expect(ModalityOfSpinning::PoiDynamics::CONTINUOUS_DYNAMICS).to include("sustaining movement")
end

Given("Siteswap pattern {string}") do |pattern|
  @pattern = pattern
  @siteswap = ModalityOfSpinning::Siteswap.new(pattern)
end

When("interpreted as juggling") do
  @interpretation = :juggling
end

Then("throws alternate evenly between hands") do
  expect(ModalityOfSpinning::Section3::EXAMPLE_3_1[:juggling]).to include("alternation")
end

When("interpreted as poi spinning") do
  @interpretation = :poi
end

Then("the form may be a wall-plane spiral") do
  expect(ModalityOfSpinning::Section3::EXAMPLE_3_1[:poi_forms]).to include(:wall_plane_spiral)
end

And("the form may be an asymmetric weave") do
  expect(ModalityOfSpinning::Section3::EXAMPLE_3_1[:poi_forms]).to include(:asymmetric_weave)
end

And("the form may be a pendulum with active correction") do
  expect(ModalityOfSpinning::Section3::EXAMPLE_3_1[:poi_forms]).to include(:pendulum_with_correction)
end

Then("all forms preserve the same rhythmic structure") do
  expect(ModalityOfSpinning::Section3::EXAMPLE_3_1[:poi_forms].length).to be > 1
end

Then("in juggling it alternates high holding and medium throws") do
  expect(ModalityOfSpinning::Section3::PATTERN_5223[:siteswap]).to include("alternation")
end

Then('in poi digit "2" is an active rotation phase') do
  expect(ModalityOfSpinning::Section3::PATTERN_5223[:poi]["2"]).to eq(:active_rotation_phase)
end

Then('in poi digit "5" is an intensified acceleration') do
  expect(ModalityOfSpinning::Section3::PATTERN_5223[:poi]["5"]).to eq(:intensified_acceleration)
end

Given("Siteswap notation") do
  @siteswap = ModalityOfSpinning::Siteswap.new("3")
end

Then("it records when the next interaction should occur") do
  expect(ModalityOfSpinning.conclusion[:ordering_tool]).to be true
end

But("it does not record what happens between interactions") do
  expect(@siteswap.describes_trajectory?).to be false
end

And("it does not record by what means interaction happens") do
  expect(ModalityOfSpinning::Section1::LIMITATIONS).to include("kinetic detail")
end

Given("the cascade notion from classical juggling") do
  @cascade = :cascade
end

When("applied to poi by analogy") do
  @prop = ModalityOfSpinning::Poi
end

Then("there is no direct equivalent in poi") do
  expect(ModalityOfSpinning::Cascade::NO_POI_EQUIVALENT).to include("no direct equivalent")
end

Given("throw is not a discrete event") do
  @discrete_throw = false
end

Given("trajectory is continuous") do
  @continuous = true
end

Given("torque influences movement") do
  @torque = true
end

Then("exact reproduction of cascade structure is impossible") do
  expect(ModalityOfSpinning::Cascade.reproducible_in?(@prop)).to be false
end

Then('the claim "there is no cascade in poi" denies form transfer not rhythmic analogue') do
  expect(ModalityOfSpinning::Cascade::PROPOSITION_4_1).to include("not denial of a rhythmic analogue")
end

Given('a juggler with balls performing pattern "3" as a cascade') do
  @ensemble = ModalityOfSpinning::Ensemble::SCENARIO_5_1
end

Given('a poi spinner performing pattern "3" with the same rhythm') do
  expect(@ensemble.first.pattern).to eq("3")
end

When("bodily kinematics are compared") do
  @divergent = ModalityOfSpinning::Ensemble.new(performers: @ensemble, parameters: nil).semantic_divergence?
end

Then("the performers execute fundamentally different actions") do
  expect(@divergent).to be true
end

But("the notation agrees formally") do
  expect(ModalityOfSpinning::Ensemble.new(performers: @ensemble, parameters: nil).same_rhythm?).to be true
end

Given("performers with different prop types") do
  @ensemble = ModalityOfSpinning::Ensemble::SCENARIO_5_1
end

Given("hold method is unspecified") { @hold = nil }
Given("rotation direction is unspecified") { @rotation = nil }
Given("plane is unspecified") { @plane = nil }
Given("acceleration character is unspecified") { @accel = nil }

Then("semantic divergence arises despite formal notational agreement") do
  ensemble = ModalityOfSpinning::Ensemble.new(performers: @ensemble, parameters: nil)
  expect(ensemble.formally_agreed?).to be true
end

Given("Siteswap as an abstraction") do
  @siteswap = ModalityOfSpinning::Siteswap.new("5223")
end

Then("it is not a universal system for describing movement") do
  expect(ModalityOfSpinning.conclusion[:universal]).to be false
end

Then("flexible torque-based systems require extended models or a limited domain") do
  expect(ModalityOfSpinning.conclusion[:summary]).to include("rhythmic grid")
end

Given("Siteswap in its current form") do
  @siteswap = ModalityOfSpinning::Siteswap.new("3")
end

Then("it performs communicative and rhythmic function") do
  expect(ModalityOfSpinning.conclusion[:communicative]).to be true
end

But("it cannot be the sole descriptor for continuous phase-dependent movement") do
  expect(ModalityOfSpinning.conclusion[:sole_descriptor_for_continuous_movement]).to be false
end

And("it tells when the next interaction should occur") do
  expect(ModalityOfSpinning.conclusion[:ordering_tool]).to be true
end

And("it leaves open how that interaction is realised") do
  expect(ModalityOfSpinning.conclusion[:summary]).to include("leaves open how")
end
