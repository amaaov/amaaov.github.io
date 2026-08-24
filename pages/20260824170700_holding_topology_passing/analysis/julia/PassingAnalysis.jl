module PassingAnalysis

struct ThrowToken
    height::Int
    crossing::Bool
    pass::Bool
    pass_target::Union{Nothing,Int}
end

struct PassingPattern
    body_count::Int
    starting_hands::Vector{Int}
    throws::Vector{Vector{Vector{ThrowToken}}}
end

struct PassingEvent
    beat::Int
    height::Int
    ball::Union{Nothing,Int}
    from_body::Int
    from_contact::Int
    from_hand::Int
    to_body::Int
    to_contact::Int
    to_hand::Int
    hold::Bool
    pass::Bool
    socket_index::Int
    kind::String
end

struct PassingSchedule
    pattern::Union{Nothing,PassingPattern}
    ball_count::Int
    highest::Int
    cycle_tosses::Vector{PassingEvent}
    cycle_length::Int
    period::Int
    hand_count::Int
    body_count::Int
    hand_period::Int
end

const FIXTURES = [
    (name="partitioned_double_cascade", notation="<3|3>", grammar="jl"),
    (name="ultimate_six", notation="<3p|3p>", grammar="jl"),
    (name="two_count_six", notation="<3p 3|3p 3>", grammar="jl"),
    (name="seven_club_two_count", notation="<R|L><4xp|3><3|4xp>", grammar="jl"),
    (name="six_club_pps", notation="<3p 3p 3|3p 3p 3>", grammar="jl"),
    (name="four_club_hold", notation="<2|2>", grammar="jl"),
    (name="two_club_one_count", notation="<1p|1p>", grammar="jl"),
    (name="three_club_two_count", notation="<1p 2|2 1p>", grammar="jl"),
    (name="four_club_two_count_zips", notation="<2p 2|2p 2>", grammar="jl"),
    (name="four_club_pps_zips", notation="<2p 2p 2|2p 2p 2>", grammar="jl"),
    (name="four_club_four_count_zips", notation="<2p 2 2 2|2p 2 2 2>", grammar="jl"),
    (name="four_club_flash", notation="<4 0|4 0>", grammar="jl"),
    (name="triangle_one_count", notation="<3p2|3p3|3p1>", grammar="jl"),
    (name="triangle_two_count", notation="<3p2|3p3|3p1><3|3|3>", grammar="jl"),
    (name="triangle_zips", notation="<2p2|2p3|2p1><2|2|2>", grammar="jl"),
    (name="feed_nine", notation="<3p2 3 3p3 3|3p1 3 3 3|3 3 3p1 3>", grammar="jl"),
    (name="four_hand_seven", notation="7", grammar="4hs"),
    (name="four_hand_744", notation="744", grammar="4hs"),
    (name="four_hand_77466", notation="77466", grammar="4hs"),
    (name="four_hand_77722", notation="77722", grammar="4hs"),
    (name="four_hand_966", notation="966", grammar="4hs"),
]
const BEAT_SECONDS = 2 // 5
const DWELL_RATIO = 1 // 4

include("passing_notation.jl")
include("passing_route.jl")
include("passing_schedule.jl")
include("passing_four_hand.jl")
include("passing_occupancy.jl")

export parse_passing_siteswap,
       schedule_passing,
       schedule_four_hand,
       occupancy_shares,
       body_occupancy_shares,
       DWELL_RATIO,
       BEAT_SECONDS,
       FIXTURES

end
