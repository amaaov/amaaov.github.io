#!/usr/bin/env ruby

root = File.expand_path(__dir__)
repo_root = File.expand_path("../../..", root)
spec_dir = "spec/pages/20260824170700_holding_topology_passing"
julia_test = File.join(root, "julia/test/runtests.jl")
ruby_generate = File.join(root, "ruby/generate.rb")
julia_generate = File.join(root, "julia/generate.jl")

system(
  "bundle", "exec", "polyrun",
  "#{spec_dir}/passing_schedule_test.rb",
  "#{spec_dir}/passing_occupancy_cases_test.rb",
  "--", "bundle", "exec", "ruby", "-I", ".", "-rminitest/autorun",
  chdir: repo_root
) or abort("ruby passing tests failed")
system("julia", julia_test) or abort("julia passing tests failed")
system("ruby", ruby_generate) or abort("ruby occupancy generate failed")
system("julia", julia_generate) or abort("julia occupancy generate failed")
system(
  "bundle", "exec", "polyrun",
  "#{spec_dir}/passing_crosscheck_test.rb",
  "--", "bundle", "exec", "ruby", "-I", ".", "-rminitest/autorun",
  chdir: repo_root
) or abort("ruby/julia occupancy crosscheck failed")
