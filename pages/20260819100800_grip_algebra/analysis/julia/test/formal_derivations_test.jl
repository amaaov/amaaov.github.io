@testset "formal derivation laws" begin
    phase = two_object_phase_law(2 // 5, 2 // 5)
    separated = two_object_phase_law(2 // 5, 1 // 2)
    @test phase.macrostate_shares == [1 // 5, 4 // 5, 0]
    @test separated.macrostate_shares == phase.macrostate_shares
    @test phase.alpha_bout_fractions == [1 // 5]
    @test separated.alpha_bout_fractions == [1 // 10, 1 // 10]
    long_duty = two_object_phase_law(7 // 10, 2 // 5)
    @test long_duty.macrostate_shares == [0, 3 // 5, 2 // 5]
    @test isempty(long_duty.alpha_bout_fractions)

    bernoulli = bernoulli_temporal_law([1 // 4, 1 // 2, 3 // 4])
    @test bernoulli.p_alpha == 3 // 32
    @test bernoulli.p_amphoteron == 13 // 16
    @test bernoulli.p_kappa == 3 // 32
    @test bernoulli.expected_held_count == 3 // 2

    for object_count in 2:12
        expectations = one_bit_first_passage_steps(object_count)
        @test first(expectations) == 0
        @test last(expectations) == 0
        @test one_bit_closed_form_first_passage(object_count, 0) == 0
        @test one_bit_closed_form_first_passage(object_count, object_count) == 0
        @test expectations == reverse(expectations)
        for held_count in 1:(object_count - 1)
            @test one_bit_recurrence_residual(expectations, held_count) == 0
            @test expectations[held_count + 1] ==
                one_bit_closed_form_first_passage(object_count, held_count)
        end
    end

    half = gaussian_correction_maximum(1 / 2)
    @test half.sigma_over_radius ≈ sqrt(3 / (8log(2))) atol=1e-15
    @test half.maximum_probability ≈ 0.32267456883476864 atol=1e-14
    @test half.derivative_at_maximum ≈ 0 atol=1e-14
    for inner_fraction in [1 / 4, 3 / 4]
        maximum = gaussian_correction_maximum(inner_fraction)
        @test maximum.derivative_at_maximum ≈ 0 atol=1e-14
        @test gaussian_correction_probability(
            maximum.sigma_over_radius, inner_fraction,
        ) > gaussian_correction_probability(
            maximum.sigma_over_radius * 0.99, inner_fraction,
        )
        @test gaussian_correction_probability(
            maximum.sigma_over_radius, inner_fraction,
        ) > gaussian_correction_probability(
            maximum.sigma_over_radius * 1.01, inner_fraction,
        )
    end
    grid = range(0.01, 2.0; length=200_000)
    probabilities = gaussian_correction_probability.(grid, 1 / 2)
    numerical_scale = grid[argmax(probabilities)]
    @test abs(numerical_scale - half.sigma_over_radius) <= step(grid)

    rows = formal_derivation_rows()
    @test length(rows) == 286
    @test Set(row.derivation for row in rows) == Set([
        "two_object_phase", "bernoulli_temporal", "one_bit_first_passage",
        "gaussian_correction",
    ])
    @test all(!isempty(row.assumption) for row in rows)

    mktemp() do path, stream
        close(stream)
        write_csv(path, rows)
        comparisons = formal_derivation_crosscheck_rows(rows, path)
        @test length(comparisons) == length(rows)
        @test all(row.status == "match" for row in comparisons)
        @test [row.result_class for row in comparisons] ==
            [row.result_class for row in rows]

        source = read(path, String)
        write(path, replace(source, "3/5" => "7/10"; count=1))
        altered = formal_derivation_crosscheck_rows(rows, path)
        @test altered[1].status == "mismatch"
        @test altered[1].comparison_mode == "exact"
    end
end
