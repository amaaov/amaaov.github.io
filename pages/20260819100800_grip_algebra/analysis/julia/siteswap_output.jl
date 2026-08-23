const SITESWAP_RESULT_COLUMNS = [
    :scenario, :notation, :timing_family, :object_count, :hand_count,
    :notation_period_beats, :protocol_cycle_beats, :beat_seconds, :dwell_ratio,
    :hold_twos, :period_seconds, :scheduled_packet_count, :active_packet_count,
    :empty_packet_count, :throw_action_count, :hold_action_count,
    :release_packet_count, :capture_packet_count, :max_action_packet,
    :max_release_packet, :max_capture_packet, :release_concentration,
    :occupancy_shares, :p_alpha, :p_amphoteron, :p_kappa,
    :mean_normalized_retention, :airborne_pair_exposure, :alpha_entry_count,
    :alpha_entry_rate_hz, :alpha_bout_count, :alpha_bout_lengths_seconds,
    :alpha_mean_bout_seconds, :alpha_maximum_bout_seconds, :model_assumption,
    :comparison_hypothesis, :empirical_status, :result_class,
]
const SITESWAP_RATIONAL_COLUMNS = Set([
    :notation_period_beats, :protocol_cycle_beats, :beat_seconds, :dwell_ratio,
    :period_seconds, :release_concentration, :occupancy_shares, :p_alpha,
    :p_amphoteron, :p_kappa, :mean_normalized_retention,
    :airborne_pair_exposure, :alpha_entry_rate_hz, :alpha_bout_lengths_seconds,
    :alpha_mean_bout_seconds, :alpha_maximum_bout_seconds,
])

function siteswap_fraction(value::Rational)
    return denominator(value) == 1 ? string(numerator(value)) :
        "$(numerator(value))/$(denominator(value))"
end
siteswap_exact(value::AbstractVector) = join(siteswap_fraction.(value), ';')
siteswap_exact(value::Rational) = siteswap_fraction(value)

function siteswap_decimal(value)
    value isa AbstractVector && return join((@sprintf("%.12g", Float64(entry))
                                             for entry in value), ';')
    value isa Rational && return @sprintf("%.12g", Float64(value))
    return value
end

function write_siteswap_hypothesis_csv(path::AbstractString, rows)
    isempty(rows) && error("siteswap results require at least one row")
    headers = reduce(vcat, (column in SITESWAP_RATIONAL_COLUMNS ?
        [column, Symbol("$(column)_exact")] : [column]
        for column in SITESWAP_RESULT_COLUMNS); init=Symbol[])
    mkpath(dirname(path))
    open(path, "w") do stream
        println(stream, join(string.(headers), ','))
        for row in rows
            values = Any[]
            for column in SITESWAP_RESULT_COLUMNS
                value = getproperty(row, column)
                push!(values, siteswap_decimal(value))
                column in SITESWAP_RATIONAL_COLUMNS && push!(values, siteswap_exact(value))
            end
            println(stream, join(csv_value.(values), ','))
        end
    end
    return path
end
