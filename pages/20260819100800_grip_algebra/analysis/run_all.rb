require "rbconfig"
require "fileutils"
require "tmpdir"

analysis_directory = __dir__
ENV["JULIA_DEPOT_PATH"] ||= File.join(Dir.tmpdir, "grip-algebra-julia-depot")
test_steps = [
  ["Ruby tests", [RbConfig.ruby, File.join(analysis_directory, "ruby/test/run.rb")]],
  ["Julia tests", ["julia", "--startup-file=no", "--check-bounds=yes", File.join(analysis_directory, "julia/test/runtests.jl")]]
]
test_steps.each do |label, command|
  puts "\n#{label}"
  abort "#{label} failed" unless system(*command, chdir: analysis_directory)
end

generators = [
  ["Ruby exact analysis", [RbConfig.ruby, File.join(analysis_directory, "ruby/generate.rb")]],
  ["Julia numerical analysis", ["julia", "--startup-file=no", File.join(analysis_directory, "julia/run_analysis.jl")]],
  ["Julia siteswap cross-check", ["julia", "--startup-file=no", File.join(analysis_directory, "julia/generate.jl")]]
]
result_names = %w[
  algebra.csv phase_metrics.csv phase_counterexamples.csv phase_sweep.csv one_bit_null.csv
  independent_retention_null.csv siteswap_hypotheses_ruby.csv siteswap_hypotheses_julia.csv
  siteswap_crosscheck.csv formal_derivations_ruby.csv formal_derivations_julia.csv
  formal_derivation_crosscheck.csv
  mechanics.csv reliability.csv reliability_benchmarks.csv matched_flight.csv tempo_dwell.csv
  noise_ablations.csv dimensionless_collapse.csv viability_summary.csv viability_diagnostics.csv
  crosscheck.csv human_analysis.csv
]
Dir.mktmpdir("grip-algebra-results") do |staging_directory|
  generators.each do |label, command|
    puts "\n#{label}"
    environment = { "GRIP_RESULTS_DIRECTORY" => staging_directory }
    abort "#{label} failed" unless system(environment, *command, chdir: analysis_directory)
  end
  missing = result_names.reject { |name| File.file?(File.join(staging_directory, name)) }
  abort "Missing generated results: #{missing.join(", ")}" unless missing.empty?

  results_directory = File.join(analysis_directory, "results")
  FileUtils.mkdir_p(results_directory)
  result_names.each do |name|
    FileUtils.cp(File.join(staging_directory, name), File.join(results_directory, name))
  end
end

puts "\nResults: #{File.join(analysis_directory, "results")}"
