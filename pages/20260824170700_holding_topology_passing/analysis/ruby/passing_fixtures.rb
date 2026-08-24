module PassingAnalysis
  FIXTURES = [
    { name: "partitioned_double_cascade", notation: "<3|3>", grammar: "jl" },
    { name: "ultimate_six", notation: "<3p|3p>", grammar: "jl" },
    { name: "two_count_six", notation: "<3p 3|3p 3>", grammar: "jl" },
    { name: "seven_club_two_count", notation: "<R|L><4xp|3><3|4xp>", grammar: "jl" },
    { name: "six_club_pps", notation: "<3p 3p 3|3p 3p 3>", grammar: "jl" },
    { name: "four_club_hold", notation: "<2|2>", grammar: "jl" },
    { name: "two_club_one_count", notation: "<1p|1p>", grammar: "jl" },
    { name: "three_club_two_count", notation: "<1p 2|2 1p>", grammar: "jl" },
    { name: "four_club_two_count_zips", notation: "<2p 2|2p 2>", grammar: "jl" },
    { name: "four_club_pps_zips", notation: "<2p 2p 2|2p 2p 2>", grammar: "jl" },
    { name: "four_club_four_count_zips", notation: "<2p 2 2 2|2p 2 2 2>", grammar: "jl" },
    { name: "four_club_flash", notation: "<4 0|4 0>", grammar: "jl" },
    { name: "triangle_one_count", notation: "<3p2|3p3|3p1>", grammar: "jl" },
    { name: "triangle_two_count", notation: "<3p2|3p3|3p1><3|3|3>", grammar: "jl" },
    { name: "triangle_zips", notation: "<2p2|2p3|2p1><2|2|2>", grammar: "jl" },
    { name: "feed_nine", notation: "<3p2 3 3p3 3|3p1 3 3 3|3 3 3p1 3>", grammar: "jl" },
    { name: "four_hand_seven", notation: "7", grammar: "4hs" },
    { name: "four_hand_744", notation: "744", grammar: "4hs" },
    { name: "four_hand_77466", notation: "77466", grammar: "4hs" },
    { name: "four_hand_77722", notation: "77722", grammar: "4hs" },
    { name: "four_hand_966", notation: "966", grammar: "4hs" }
  ].freeze
  BEAT_SECONDS = Rational(2, 5)
  DWELL_RATIO = Rational(1, 4)
end
