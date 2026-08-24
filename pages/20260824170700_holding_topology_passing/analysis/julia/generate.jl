include("PassingAnalysis.jl")
using .PassingAnalysis

const OUTPUT_PATH = joinpath(@__DIR__, "..", "results", "occupancy_julia.csv")

function share_text(shares)
    return join(format_rational.(shares), " ")
end

function format_rational(value)
    rational = Rational{Int}(value)
    return "$(numerator(rational))/$(denominator(rational))"
end

function schedule_for(fixture)
    if fixture.grammar == "4hs"
        return schedule_four_hand(fixture.notation)
    end
    return schedule_passing(fixture.notation)
end

function metric_row(fixture)
    schedule = schedule_for(fixture)
    occupancy = occupancy_shares(schedule; dwell_ratio=DWELL_RATIO)
    bodies = body_occupancy_shares(schedule; dwell_ratio=DWELL_RATIO)
    mean_q = sum(share * (held - 1) for (held, share) in enumerate(occupancy.occupancy_shares))
    pass_count = count(event -> event.pass, schedule.cycle_tosses)
    self_count = count(event -> event.kind != "empty" && !event.pass, schedule.cycle_tosses)
    return [
        fixture.name, fixture.notation, fixture.grammar, string(schedule.hand_period),
        string(schedule.cycle_length), string(schedule.period), string(schedule.ball_count),
        string(schedule.hand_count), format_rational(BEAT_SECONDS), format_rational(DWELL_RATIO),
        format_rational(occupancy.p_alpha), format_rational(occupancy.p_polymorphy),
        format_rational(occupancy.p_kappa), share_text(occupancy.occupancy_shares),
        format_rational(mean_q), string(pass_count), string(self_count),
        join(share_text.(bodies), " | "),
    ]
end

function write_occupancy_csv(path)
    mkpath(dirname(path))
    open(path, "w") do io
        println(io, join([
            "scenario", "notation", "grammar", "hand_period", "cycle_length_beats",
            "notation_period_beats", "object_count", "hand_count", "beat_seconds", "dwell_ratio",
            "p_alpha", "p_polymorphy", "p_kappa", "occupancy_shares", "mean_q", "pass_count",
            "self_count", "body_occupancy_shares",
        ], ","))
        for fixture in FIXTURES
            println(io, join(metric_row(fixture), ","))
        end
    end
end

if abspath(PROGRAM_FILE) == @__FILE__
    write_occupancy_csv(OUTPUT_PATH)
end
