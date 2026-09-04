export const measurementRubyFormulas = [
  ["mixed-time-share", `mixed_time = measure(0..total_time) do |time|
  q(time).between?(1, n - 1)
end
probability_mixed = mixed_time / total_time`],
  ["mean-grip", `mean_grip = integrate(0..total_time) { |time| q(time) } /
  (n * total_time)`],
  ["occupancy-share", `occupancy_share = (0..n).to_h do |j|
  duration = measure(0..total_time) { |time| q(time) == j }
  [j, duration / total_time]
end`],
  ["mean-value-identity", `(flights + drops).fdiv(values + drops) ==
  balls.fdiv(period)`],
  ["cascade-occupancies", `occupancies = if r <= 0.5
  [1 - 2 * r, 2 * r, 0, 0]
else
  [0, 2 - 2 * r, 2 * r - 1, 0]
end`],
  ["overlap", `positive_part = ->(x) { [x, 0].max }
overlap = positive_part[d - phase] + positive_part[d + phase - 1]`],
  ["overlap-states", `probability_alpha = 1 - 2 * dwell + overlap
probability_mixed = 2 * (dwell - overlap)
probability_kappa = overlap`],
  ["phase-occupancies", `occupancies = if phase <= 0.4
  [0.6 - phase, 2 * phase, 0.4 - phase]
else
  [0.2, 0.8, 0]
end`],
  ["throw-phase", `throw_phase = (throw_time - catch_times[j]).fdiv(
  catch_times[j + 1] - catch_times[j]
)`],
  ["structural-coordinates", `total_releases = releases.sum
release_concentration = total_releases.zero? ? 0 :
  releases.sum { |count| count * (count - 1) }.fdiv(total_releases)
empty_share = actions.count(0).fdiv(actions.size)
longest_empty_run = longest_circular_run(actions, 0)`],
  ["rhythm-switching", `switches = rhythms.zip(rhythms.rotate).count { |a, b| a != b }
switching_density = switches.fdiv(notation_period)`],
  ["airborne-pairs", `pair_exposure = expectation { airborne * (airborne - 1) }.fdiv(2)
# also: (variance + mean**2 - mean) / 2`],
  ["total-release", `entry_rate = alpha_entries.fdiv(total_time)
probability_alpha = measure(0..total_time) { |time| q(time).zero? } /
  total_time`],
  ["vertical-impulse", `integrate(0..total_time) { |time| vertical_force(time) } ==
  total_mass * gravity * total_time`],
  ["force-bounds", `peak_force >= total_mass * gravity / (1 - probability_alpha)
rms_force >= total_mass * gravity / Math.sqrt(1 - probability_alpha)`],
  ["cascade-force-bounds", `peak_force >= 3 * ball_mass * gravity / (2 * r)
rms_force >= 3 * ball_mass * gravity / Math.sqrt(2 * r)`],
  ["launch-energy", `throws.each do |throw|
  throw.vertical_speed = gravity * throw.flight_time / 2
  throw.height = gravity * throw.flight_time**2 / 8
end
launch_energy_rate = throws.sum { |throw| throw.mass * gravity * throw.height } /
  total_time`],
];
