export const topologyRubyFormulas = [
  ["held-state", `held = objects.select { |object| retained?(object, time) }
q = held.size
n = objects.size`],
  ["system-state", `state = [bits.any?(0), bits.any?(1)]
# [some object unheld, some object held]`],
  ["sign-pair", `sign = {
  [true, false] => :alpha,
  [false, true] => :kappa,
  [true, true] => :alpha_kappa
}.fetch(state)`],
  ["occupancy-sign", `sign = case q
       when 0 then :alpha
       when n then :kappa
       else :alpha_kappa
       end`],
  ["quantifiers", `some_unheld = bits.any?(0)
none_held = bits.none?(1) # same as bits.all?(0)`],
  ["mixed-state", `mixed = bits.uniq.size > 1
sign = :alpha_kappa if mixed`],
  ["sign-union", `union_sign = sign_for(objects_a | objects_b)`],
  ["mixed-union", `join(:kappa, :alpha) # => :alpha_kappa`],
  ["cube-edge", `distance = (held_a - held_b).size + (held_b - held_a).size
neighbors = distance == 1`],
  ["event-balance", `q_after - q_before == captures - releases`],
  ["independent-probabilities", `probability_alpha = retention_probabilities.reduce(1.0) { |p, rho| p * (1 - rho) }
probability_kappa = retention_probabilities.reduce(1.0, :*)
probability_mixed = 1 - probability_alpha - probability_kappa`],
  ["three-object-cycle", `cycle = [[1], [1, 2], [2], [2, 3], [3], [3, 1], [1]]`],
  ["cycle-rank", `cycle_rank = (n - 2) * 2**(n - 1) - 2 * n + 3`],
  ["boundary-distance", `boundary_distance = [q, n - q].min`],
  ["buffer-threshold", `buffered_state_exists = n >= 2 * s + 2`],
  ["buffered-interior", `interior = subsets.select do |held|
  s < held.size && held.size < n - s
end`],
  ["boundary-hitting-time", `boundary_step = occupancies.index { |q| q == 0 || q == n }
expected_steps = expectation(boundary_step, given: { q0: q })`],
  ["hitting-recurrence", `def expected_boundary_steps(q, n, expected)
  return 0 if q == 0 || q == n

  1 + q.fdiv(n) * expected[q - 1] +
    (n - q).fdiv(n) * expected[q + 1]
end`],
  ["sign-cycle", `states = %i[kappa alpha_kappa alpha alpha_kappa kappa]`],
  ["pattern-projection", `projection = [sign_for(pattern), held_at(pattern, time)]`],
];
