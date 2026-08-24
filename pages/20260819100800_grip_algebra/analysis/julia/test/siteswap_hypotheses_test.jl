const SITESWAP_PROTOCOLS_PATH = normpath(joinpath(
    @__DIR__, "..", "..", "siteswap_protocols.csv",
))
const RUBY_SITESWAP_RESULTS_PATH = normpath(joinpath(
    @__DIR__, "..", "..", "results", "siteswap_hypotheses_ruby.csv",
))
const REQUIRED_SITESWAP_NOTATIONS = [
    "3", "55500", "441", "531", "2[22]",
    "([44],4)(0,0)([22],2)", "5(2,4)1",
]

@testset "shared siteswap protocol contract" begin
    protocols = read_siteswap_protocols(SITESWAP_PROTOCOLS_PATH)

    @test getproperty.(protocols, :notation) == REQUIRED_SITESWAP_NOTATIONS
    @test all(protocol.object_count == 3 for protocol in protocols)
    @test all(protocol.beat_seconds == 2 // 5 for protocol in protocols)
    @test all(protocol.dwell_ratio == 1 // 4 for protocol in protocols)
    @test all(validate_siteswap_protocol(protocol) === protocol for protocol in protocols)

    header, fixture_rows = GripAnalysis.read_csv_table(SITESWAP_PROTOCOLS_PATH)
    height_column = findfirst(==("throw_height"), header)
    broken_rows = deepcopy(fixture_rows)
    broken_rows[1][height_column] = "2"
    mktemp() do path, stream
        println(stream, join(GripAnalysis.csv_value.(header), ','))
        for row in broken_rows
            println(stream, join(GripAnalysis.csv_value.(row), ','))
        end
        close(stream)
        @test_throws ArgumentError read_siteswap_protocols(path)
    end
end

@testset "independent exact siteswap metrics" begin
    rows = siteswap_hypothesis_rows(read_siteswap_protocols(SITESWAP_PROTOCOLS_PATH))
    by_notation = Dict(row.notation => row for row in rows)
    cascade = by_notation["3"]
    clustered = by_notation["55500"]
    four_four_one = by_notation["441"]
    five_three_one = by_notation["531"]
    hold = by_notation["2[22]"]
    synchronous = by_notation["([44],4)(0,0)([22],2)"]
    hybrid = by_notation["5(2,4)1"]

    @test cascade.p_alpha == 1 // 2
    @test clustered.p_alpha == 7 // 10
    @test four_four_one.occupancy_shares == cascade.occupancy_shares
    @test five_three_one.occupancy_shares == cascade.occupancy_shares
    @test cascade.max_release_packet == 1
    @test cascade.release_concentration == 0

    @test hold.occupancy_shares == [0, 0, 0, 1]
    @test hold.max_release_packet == 0
    @test hold.max_action_packet == 2
    @test synchronous.p_alpha == 7 // 12
    @test synchronous.p_kappa == 5 // 12
    @test synchronous.airborne_pair_exposure == 7 // 4
    @test synchronous.max_release_packet == 3
    @test synchronous.release_concentration == 2

    @test hybrid.occupancy_shares == [1 // 4, 5 // 8, 1 // 8, 0]
    @test hybrid.p_alpha == 1 // 4
    @test hybrid.p_polymorphy == 3 // 4
    @test hybrid.alpha_entry_count == 4
    @test hybrid.alpha_bout_lengths_seconds == fill(1 // 5, 4)
    @test hybrid.max_action_packet == 2
    @test hybrid.max_release_packet == 1

    @test all(sum(row.occupancy_shares) == 1 for row in rows)
    @test all(row.p_alpha + row.p_polymorphy + row.p_kappa == 1 for row in rows)
    @test all(row.result_class == "model consequence" for row in rows)
    @test all(row.empirical_status == "untested empirical hypothesis" for row in rows)
end

@testset "Ruby Julia siteswap exact cross-check" begin
    rows = siteswap_hypothesis_rows(read_siteswap_protocols(SITESWAP_PROTOCOLS_PATH))
    comparisons = siteswap_crosscheck_rows(rows, RUBY_SITESWAP_RESULTS_PATH)

    @test length(comparisons) == length(rows)
    @test all(row.status == "match" for row in comparisons)
    @test all(row.mismatch_count == 0 for row in comparisons)
    @test all(row.metrics_compared == length(SITESWAP_EXACT_METRICS) for row in comparisons)
    @test all(row.result_class == "model consequence" for row in comparisons)
    @test all(row.empirical_status == "not an empirical test" for row in comparisons)

    ruby_header, ruby_rows = GripAnalysis.read_csv_table(RUBY_SITESWAP_RESULTS_PATH)
    alpha_column = findfirst(==("p_alpha_exact"), ruby_header)
    ruby_rows[1][alpha_column] = "3/5"
    mktemp() do path, stream
        println(stream, join(GripAnalysis.csv_value.(ruby_header), ','))
        for row in ruby_rows
            println(stream, join(GripAnalysis.csv_value.(row), ','))
        end
        close(stream)
        altered = siteswap_crosscheck_rows(rows, path)
        @test altered[1].status == "mismatch"
        @test altered[1].mismatch_count == 1
        @test altered[1].mismatched_metrics == "p_alpha"
        @test all(row.status == "match" for row in altered[2:end])
    end
end

@testset "siteswap result generation" begin
    mktempdir() do results_directory
        summary = generate_siteswap_analysis(
            SITESWAP_PROTOCOLS_PATH, results_directory, RUBY_SITESWAP_RESULTS_PATH,
        )
        @test summary.siteswap_rows == 7
        @test summary.crosscheck_rows == 7
        @test summary.crosscheck_status == "match"
        @test Set(readdir(results_directory)) == Set([
            "siteswap_hypotheses_julia.csv", "siteswap_crosscheck.csv",
        ])
        julia_output = read(
            joinpath(results_directory, "siteswap_hypotheses_julia.csv"), String,
        )
        crosscheck_output = read(
            joinpath(results_directory, "siteswap_crosscheck.csv"), String,
        )
        @test occursin("occupancy_shares_exact", julia_output)
        @test occursin("untested empirical hypothesis", julia_output)
        @test occursin("metrics_compared", crosscheck_output)
        @test occursin("not an empirical test", crosscheck_output)
    end
end
