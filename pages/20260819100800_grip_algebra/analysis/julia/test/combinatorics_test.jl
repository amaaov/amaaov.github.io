@testset "combinatorics quoted in the article" begin
    @test fubini_number.([0, 1, 2, 3, 4, 5]) == [1, 1, 3, 13, 75, 541]
    @test companion_release_count([1, 1, 1, 1]) == 0
    @test companion_release_count([2, 2, 2]) == 1
    @test companion_release_count([3, 3]) == 2
    @test companion_release_count([2, 1]) == 2 // 3
    @test interior_state_count.([4, 5, 6], 1) == [6, 20, 50]
    @test mixed_cycle_rank.([3, 4, 5]) == [1, 11, 41]
    @test mixed_cycle_rank_enumerated.([3, 4, 5]) == [1, 11, 41]

    for dwell in (1 // 5, 1 // 4, 2 // 5)
        law = two_object_phase_law(dwell, 1 // 2)
        @test law.p_alpha == 1 - 2 * dwell
        @test 3 // (1 - law.p_alpha) == 3 // (2 * dwell)
    end
end
