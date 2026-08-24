#!/usr/bin/env ruby

root = File.expand_path(__dir__)
ruby_test = File.join(root, "ruby/test/passing_schedule_test.rb")
occupancy_test = File.join(root, "ruby/test/passing_occupancy_cases_test.rb")
julia_test = File.join(root, "julia/test/runtests.jl")
ruby_generate = File.join(root, "ruby/generate.rb")
julia_generate = File.join(root, "julia/generate.jl")
crosscheck = File.join(root, "ruby/test/passing_crosscheck_test.rb")

system("ruby", ruby_test) or abort("ruby passing tests failed")
system("ruby", occupancy_test) or abort("ruby occupancy case tests failed")
system("julia", julia_test) or abort("julia passing tests failed")
system("ruby", ruby_generate) or abort("ruby occupancy generate failed")
system("julia", julia_generate) or abort("julia occupancy generate failed")
system("ruby", crosscheck) or abort("ruby/julia occupancy crosscheck failed")
