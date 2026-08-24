using Test

include(joinpath(@__DIR__, "..", "PassingAnalysis.jl"))
using .PassingAnalysis

function packet(notation, beat)
    schedule = schedule_passing(notation)
    return [
        (event.from_hand, event.to_hand, event.height, event.kind)
        for event in schedule.cycle_tosses if event.beat == beat
    ]
end

@testset "ultimate six routes right-hand passes to the partner left" begin
    schedule = schedule_passing("<3p|3p>")
    @test schedule.ball_count == 6
    @test schedule.hand_count == 4
    @test packet("<3p|3p>", 0) == [(1, 2, 3, "throw"), (3, 0, 3, "throw")]
    @test packet("<3p|3p>", 1) == [(0, 3, 3, "throw"), (2, 1, 3, "throw")]
    @test all(event.pass for event in schedule.cycle_tosses)
end

@testset "partitioned cascade stays inside each body" begin
    schedule = schedule_passing("<3|3>")
    @test schedule.ball_count == 6
    @test all(!event.pass for event in schedule.cycle_tosses)
    @test packet("<3|3>", 0) == [(1, 0, 3, "throw"), (3, 2, 3, "throw")]
end

@testset "two-count passes on even beats" begin
    schedule = schedule_passing("<3p 3|3p 3>")
    @test all(event.pass for event in schedule.cycle_tosses if iseven(event.beat))
    @test all(!event.pass for event in schedule.cycle_tosses if isodd(event.beat))
end

@testset "seven-club starts on opposite hands" begin
    @test packet("<R|L><4xp|3><3|4xp>", 0) == [(1, 2, 4, "throw"), (2, 3, 3, "throw")]
    @test packet("<R|L><4xp|3><3|4xp>", 1) == [(0, 1, 3, "throw"), (3, 0, 4, "throw")]
end

@testset "six-object unit-hand occupancy is half empty and half two-held" begin
    for notation in ("<3|3>", "<3p|3p>", "<3p 3|3p 3>")
        occupancy = occupancy_shares(schedule_passing(notation); dwell_ratio=DWELL_RATIO)
        @test occupancy.object_count == 6
        @test occupancy.p_alpha == 1 // 2
        @test occupancy.p_polymorphy == 1 // 2
        @test occupancy.p_kappa == 0
        @test occupancy.occupancy_shares == Rational{Int}[1//2, 0, 1//2, 0, 0, 0, 0]
    end
end

@testset "seven-club occupancy matches the two-throw packet law" begin
    occupancy = occupancy_shares(schedule_passing("<R|L><4xp|3><3|4xp>"); dwell_ratio=DWELL_RATIO)
    @test occupancy.object_count == 7
    @test occupancy.p_alpha == 1 // 2
    @test occupancy.p_polymorphy == 1 // 2
    @test occupancy.p_kappa == 0
    @test occupancy.occupancy_shares == Rational{Int}[1//2, 0, 1//2, 0, 0, 0, 0, 0]
end

@testset "each body holds one or none in the six-object unit-hand patterns" begin
    for notation in ("<3|3>", "<3p|3p>", "<3p 3|3p 3>")
        bodies = body_occupancy_shares(schedule_passing(notation); dwell_ratio=DWELL_RATIO)
        for shares in bodies
            @test shares[1] == 1 // 2
            @test shares[2] == 1 // 2
            @test sum(shares[3:end]; init=0 // 1) == 0
        end
    end
end

@testset "solo cascade writing is rejected" begin
    @test_throws ArgumentError parse_passing_siteswap("3")
end

@testset "zip hold flash and triangle occupancy match the packet families" begin
    hold = occupancy_shares(schedule_passing("<2|2>"); dwell_ratio=DWELL_RATIO)
    @test hold.p_kappa == 1
    @test occupancy_shares(schedule_passing("<1p|1p>"); dwell_ratio=DWELL_RATIO).occupancy_shares ==
        Rational{Int}[1//2, 0, 1//2]
    @test occupancy_shares(schedule_passing("<2p 2p 2|2p 2p 2>"); dwell_ratio=DWELL_RATIO).occupancy_shares ==
        Rational{Int}[1//6, 0, 2//3, 0, 1//6]
    triangle = occupancy_shares(schedule_passing("<3p2|3p3|3p1>"); dwell_ratio=DWELL_RATIO)
    @test triangle.object_count == 9
    @test triangle.occupancy_shares[4] == 1 // 2
    zips = occupancy_shares(schedule_passing("<2p2|2p3|2p1><2|2|2>"); dwell_ratio=DWELL_RATIO)
    @test zips.p_kappa == 1 // 4
end

@testset "four-hand seven holds exactly one club" begin
    schedule = schedule_four_hand("7")
    occupancy = occupancy_shares(schedule; dwell_ratio=DWELL_RATIO)
    @test schedule.hand_period == 4
    @test occupancy.object_count == 7
    @test occupancy.p_alpha == 0
    @test occupancy.p_polymorphy == 1
    @test occupancy.p_kappa == 0
    @test occupancy.occupancy_shares[2] == 1
    @test occupancy.occupancy_shares[3] == 0
end

@testset "four-hand named jobs visit one-held states" begin
    @test occupancy_shares(schedule_four_hand("744"); dwell_ratio=DWELL_RATIO).occupancy_shares ==
        Rational{Int}[0, 0, 0, 1, 0, 0]
    jim = occupancy_shares(schedule_four_hand("77466"); dwell_ratio=DWELL_RATIO)
    @test jim.object_count == 6
    @test jim.occupancy_shares == Rational{Int}[0, 2//5, 3//5, 0, 0, 0, 0]
end

